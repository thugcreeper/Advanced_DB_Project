package tw.advanceddb.medical;

import static org.assertj.core.api.Assertions.*;
import io.github.cdimascio.dotenv.Dotenv;
import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.neo4j.driver.*;

@Tag("neo4j-snapshot")
@EnabledIfEnvironmentVariable(named = "NEO4J_SNAPSHOT_TESTS", matches = "true", disabledReason = "Set NEO4J_SNAPSHOT_TESTS=true and provide local Neo4j credentials to run read-only snapshot tests")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class StatisticsSnapshotTest {
    private Driver driver;
    private Map<String, Object> fingerprint;
    private final Map<String, Object> parameters = Map.of("personnel", "護理師", "specialty", "內科",
            "doctors", List.of("西醫師", "中醫師", "牙醫師"), "scope", "all");

    // Reference queries validate the database snapshot, not the unimplemented statistics API.
    private static final String REFERENCE = """
            MATCH (d:鄉鎮區碼與名稱)
            OPTIONAL MATCH (d)-[ir:RECORD_INCOME {統計年:112}]->(i:綜合所得)
            OPTIONAL MATCH (d)-[pr:RECORD_POPULATION_AND_AREA {統計年:114}]->(p:人口與土地)
            CALL { WITH d OPTIONAL MATCH (d)-[mr:RECORD_MEDICAL_FACILITIES {統計年:114}]->(m:醫療院所統計)
                RETURN coalesce(sum(CASE WHEN m.類型='醫院' THEN m.院所家數 ELSE 0 END),0) AS hospitalCount,
                    coalesce(sum(CASE WHEN m.類型='診所' THEN m.院所家數 ELSE 0 END),0) AS clinicCount,
                    coalesce(sum(CASE WHEN m.類型='醫院' THEN m.醫事人員總計 ELSE 0 END),0) AS hospitalStaff,
                    coalesce(sum(CASE WHEN m.類型='診所' THEN m.醫事人員總計 ELSE 0 END),0) AS clinicStaff,
                    head(collect(DISTINCT mr.統計年)) AS medicalYear }
            CALL { WITH d OPTIONAL MATCH (d)-[r:RECORD_PERSONNEL]->(category:醫事人員類別)
                RETURN
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別=$personnel THEN r.數量 ELSE 0 END),0) AS hospitalPersonnel,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別 IN $doctors THEN r.數量 ELSE 0 END),0) AS hospitalDoctors,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別='西醫師' THEN r.數量 ELSE 0 END),0) AS hospitalWesternDoctors,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別='中醫師' THEN r.數量 ELSE 0 END),0) AS hospitalChineseDoctors,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別='牙醫師' THEN r.數量 ELSE 0 END),0) AS hospitalDentists,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別=$personnel THEN r.數量 ELSE 0 END),0) AS clinicPersonnel,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別 IN $doctors THEN r.數量 ELSE 0 END),0) AS clinicDoctors,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別='西醫師' THEN r.數量 ELSE 0 END),0) AS clinicWesternDoctors,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別='中醫師' THEN r.數量 ELSE 0 END),0) AS clinicChineseDoctors,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別='牙醫師' THEN r.數量 ELSE 0 END),0) AS clinicDentists }
            CALL { WITH d OPTIONAL MATCH (d)-[r:RECORD_DEPARTMENT]->(category:科別)
                WHERE category.科別名稱=$specialty
                RETURN coalesce(sum(CASE WHEN r.類型='醫院' THEN r.數量 ELSE 0 END),0) AS hospitalSpecialty,
                    coalesce(sum(CASE WHEN r.類型='診所' THEN r.數量 ELSE 0 END),0) AS clinicSpecialty }
            WITH d.鄉鎮市區名稱 AS name, d.鄉鎮市區碼 AS code,
                i.平均數 AS income, i.中位數 AS medianIncome, ir.統計年 AS incomeYear,
                p.年底人口數 AS population, p.人口密度 AS density, p.土地面積 AS area, pr.統計年 AS populationYear,
                medicalYear, hospitalCount, clinicCount, hospitalStaff, clinicStaff, hospitalStaff+clinicStaff AS staff,
                hospitalPersonnel, clinicPersonnel, hospitalSpecialty, clinicSpecialty, hospitalDoctors, clinicDoctors,
                hospitalWesternDoctors, clinicWesternDoctors, hospitalWesternDoctors+clinicWesternDoctors AS westernDoctors,
                hospitalChineseDoctors, clinicChineseDoctors, hospitalChineseDoctors+clinicChineseDoctors AS chineseDoctors,
                hospitalDentists, clinicDentists, hospitalDentists+clinicDentists AS dentists,
                hospitalDoctors+clinicDoctors AS doctors,
                CASE $scope WHEN 'hospital' THEN hospitalPersonnel WHEN 'clinic' THEN clinicPersonnel ELSE hospitalPersonnel+clinicPersonnel END AS personnel,
                CASE $scope WHEN 'hospital' THEN hospitalSpecialty WHEN 'clinic' THEN clinicSpecialty ELSE hospitalSpecialty+clinicSpecialty END AS specialty,
                CASE WHEN p.年底人口數>0 THEN round(10000.0*(hospitalStaff+clinicStaff)/p.年底人口數,2) ELSE null END AS staffRate,
                CASE WHEN p.年底人口數>0 THEN round(10000.0*(hospitalDoctors+clinicDoctors)/p.年底人口數,2) ELSE null END AS doctorRate,
                CASE WHEN p.年底人口數>0 THEN round(10000.0*(hospitalWesternDoctors+clinicWesternDoctors)/p.年底人口數,2) ELSE null END AS westernDoctorRate
            """;

    @BeforeAll void connect() {
        var directory = Path.of(System.getProperty("stats.env.directory", ".")).toAbsolutePath();
        var settings = Dotenv.configure().directory(directory.toString()).ignoreIfMissing().load();
        Assumptions.assumeTrue(settings.get("NEO4J_PASSWORD") != null && !settings.get("NEO4J_PASSWORD").isBlank(), "Neo4j credentials unavailable; snapshot not executed");
        driver = GraphDatabase.driver(settings.get("NEO4J_URI"), AuthTokens.basic(settings.get("NEO4J_USERNAME"), settings.get("NEO4J_PASSWORD")));
        driver.verifyConnectivity();
        fingerprint = fingerprint();
    }
    @AfterAll void unchangedDatabaseAndClose() {
        if (driver == null) return;
        try { if (fingerprint != null) assertThat(fingerprint()).as("test must not change node/relationship totals or relation quantities").isEqualTo(fingerprint); }
        finally { driver.close(); }
    }
    private Map<String, Object> fingerprint() {
        try (var session = readSession()) {
            return session.executeRead(tx -> tx.run("CALL { MATCH (n) RETURN count(n) AS nodes } CALL { MATCH ()-[r]->() RETURN count(r) AS relationships, sum(coalesce(r.數量,0)) AS quantities } RETURN nodes,relationships,quantities").single().asMap());
        }
    }
    private Session readSession() { return driver.session(SessionConfig.builder().withDatabase("neo4j").withDefaultAccessMode(AccessMode.READ).build()); }
    private List<Map<String, Object>> query(String condition, String sort, String scope) {
        var args = new HashMap<>(parameters); args.put("scope", scope);
        try (var session = readSession()) {
            return session.executeRead(tx -> tx.run(REFERENCE + condition + " RETURN * " + sort, args).list(row -> row.asMap()));
        }
    }
    private double number(Map<String, Object> row, String field) { return ((Number) row.get(field)).doubleValue(); }
    private void fields(Map<String, Object> row, String name, Object... expected) {
        assertThat(row.get("name")).isEqualTo(name);
        for (int i=0;i<expected.length;i+=2) assertThat(number(row, (String) expected[i])).as(name+" "+expected[i]).isCloseTo(((Number)expected[i+1]).doubleValue(), within(0.000001));
    }
    private void unique(List<Map<String, Object>> rows, int size) {
        assertThat(rows).hasSize(size); assertThat(rows.stream().map(row -> row.get("code")).distinct().count()).isEqualTo(size);
    }
    private void staffFormula(List<Map<String,Object>> rows) {
        rows.forEach(row -> {
            assertThat(number(row,"staff")).isEqualTo(number(row,"hospitalStaff")+number(row,"clinicStaff"));
            if (row.get("population") == null || number(row,"population")<=0) assertThat(row.get("staffRate")).isNull();
            else assertThat(number(row,"staffRate")).isCloseTo(Math.round(number(row,"staff")/number(row,"population")*10000*100)/100.0, within(0.000001));
        });
    }
    @Test void tc01HighIncome() {
        var rows=query("WHERE income>1500 AND population>0", "ORDER BY income DESC", "all"); unique(rows,5);
        String[] names={"新竹縣竹北市","新竹市東區","臺北市大安區","臺北市松山區","新竹縣寶山鄉"};
        double[] income={2059,1973,1653,1558,1505}, density={4718.207460,6618.230445,24849.754430,20168.177610,225.168282}, pop={220973,222219,282328,187318,14588}, staff={3948,3801,7899,3317,16}, rates={178.66,171.05,279.78,177.08,10.97};
        for(int i=0;i<5;i++) fields(rows.get(i),names[i],"income",income[i],"density",density[i],"population",pop[i],"staff",staff[i],"staffRate",rates[i]);
        assertThat(rows).allSatisfy(row -> assertThat(number(row,"income")).isGreaterThan(1500)); staffFormula(rows);
    }
    @Test void tc02SmallPopulation() {
        var rows=query("WHERE population>0 AND population<20000", "ORDER BY population ASC", "all"); unique(rows,132);
        fields(rows.get(0),"金門縣烏坵鄉","population",593,"hospitalCount",0,"clinicCount",0,"staff",0,"staffRate",0);
        fields(rows.get(131),"金門縣金沙鎮","population",19840,"hospitalCount",0,"clinicCount",4,"staff",11,"staffRate",5.54);
        double previous=0; for(var row:rows){assertThat(number(row,"population")).isBetween(1.0,19999.0).isGreaterThanOrEqualTo(previous);previous=number(row,"population");assertThat(number(row,"hospitalCount")).isNotNegative();assertThat(number(row,"clinicCount")).isNotNegative();} staffFormula(rows);
    }
    @Test void tc03FewClinicsWithoutHospitals() {
        var rows=query("WHERE hospitalCount=0 AND clinicCount<5", "ORDER BY clinicCount ASC,population DESC", "all");unique(rows,76);
        fields(rows.get(0),"金門縣烏坵鄉","population",593,"hospitalCount",0,"clinicCount",0,"density",494.1666667,"income",837);
        fields(rows.get(75),"苗栗縣三灣鄉","population",5664,"hospitalCount",0,"clinicCount",4,"density",108.3057342,"income",752);
        for(int i=0;i<rows.size();i++){var row=rows.get(i);assertThat(number(row,"hospitalCount")).isZero();assertThat(number(row,"clinicCount")).isBetween(0.0,4.0);if(i>0){var before=rows.get(i-1);assertThat(number(row,"clinicCount")).isGreaterThanOrEqualTo(number(before,"clinicCount"));if(number(row,"clinicCount")==number(before,"clinicCount"))assertThat(number(row,"population")).isLessThanOrEqualTo(number(before,"population"));}}
    }
    @Test void tc04NoClinic() {
        var rows=query("WHERE clinicCount=0", "ORDER BY population DESC", "all");unique(rows,2);
        fields(rows.get(0),"連江縣南竿鄉","population",7629,"density",733.5576923,"area",10.4,"income",881,"medianIncome",664,"hospitalCount",1,"clinicCount",0);
        fields(rows.get(1),"金門縣烏坵鄉","population",593,"density",494.1666667,"area",1.2,"income",837,"medianIncome",658,"hospitalCount",0,"clinicCount",0);
    }
    @Test void tc05NurseRelationshipsInThreeScopes() {
        for(String scope:List.of("hospital","clinic","all")) {
            var rows=query("", "ORDER BY personnel DESC", scope); unique(rows,368);
            for(int i=0;i<rows.size();i++){var row=rows.get(i);double expected=scope.equals("hospital")?number(row,"hospitalPersonnel"):scope.equals("clinic")?number(row,"clinicPersonnel"):number(row,"hospitalPersonnel")+number(row,"clinicPersonnel");assertThat(number(row,"personnel")).isEqualTo(expected);if(i>0)assertThat(number(row,"personnel")).isLessThanOrEqualTo(number(rows.get(i-1),"personnel"));}
            if(scope.equals("all"))fields(rows.get(0),"臺北市北投區","hospitalPersonnel",5175,"clinicPersonnel",218,"personnel",5393);
            assertThat(rows.stream().filter(row -> row.get("name").equals("金門縣烏坵鄉")).findFirst().orElseThrow().get("personnel")).isEqualTo(0L);
        }
    }
    @Test void tc06InternalMedicineRelationshipsInThreeScopes() {
        for(String scope:List.of("hospital","clinic","all")) {
            var rows=query("", "ORDER BY specialty DESC", scope);unique(rows,368);
            for(int i=0;i<rows.size();i++){var row=rows.get(i);double expected=scope.equals("hospital")?number(row,"hospitalSpecialty"):scope.equals("clinic")?number(row,"clinicSpecialty"):number(row,"hospitalSpecialty")+number(row,"clinicSpecialty");assertThat(number(row,"specialty")).isEqualTo(expected);if(i>0)assertThat(number(row,"specialty")).isLessThanOrEqualTo(number(rows.get(i-1),"specialty"));}
            if(scope.equals("all"))fields(rows.get(0),"高雄市鳳山區","hospitalSpecialty",6,"clinicSpecialty",47,"specialty",53);
            assertThat(rows.stream().filter(row -> row.get("name").equals("連江縣東引鄉")).findFirst().orElseThrow().get("specialty")).isEqualTo(0L);
        }
    }
    @Test void tc08ThreeDoctorCategoriesAndWesternRate() {
        var rows=query("", "ORDER BY westernDoctorRate DESC", "all"); unique(rows,368);
        fields(rows.get(0),"高雄市鳥松區","population",43703,"hospitalWesternDoctors",1072,"clinicWesternDoctors",24,"westernDoctors",1096,"westernDoctorRate",250.78);
    }
    @Test void threeDoctorCategoryAggregationAndRates() {
        var rows=query("", "ORDER BY westernDoctorRate DESC", "all"); unique(rows,368);
        for(int i=0;i<rows.size();i++) {
            var row=rows.get(i);
            for (var category:List.of("WesternDoctors","ChineseDoctors","Dentists")) {
                String total=Character.toLowerCase(category.charAt(0))+category.substring(1);
                assertThat(number(row,total)).isEqualTo(number(row,"hospital"+category)+number(row,"clinic"+category));
                assertThat(number(row,total)).isNotNegative();
            }
            assertThat(number(row,"doctors")).isEqualTo(number(row,"westernDoctors")+number(row,"chineseDoctors")+number(row,"dentists"));
            if(row.get("population")==null || number(row,"population")<=0) assertThat(row.get("westernDoctorRate")).isNull();
            else assertThat(number(row,"westernDoctorRate")).isCloseTo(Math.round(number(row,"westernDoctors")/number(row,"population")*10000*100)/100.0,within(0.000001));
            if(i>0 && row.get("westernDoctorRate")!=null) assertThat(number(row,"westernDoctorRate")).isLessThanOrEqualTo(number(rows.get(i-1),"westernDoctorRate"));
        }
    }
    @Test void populationAndIncomeYearsRemainSeparate() {
        var rows=query("", "", "all");unique(rows,368);
        assertThat(rows).allSatisfy(row -> {assertThat(row.get("incomeYear")).isEqualTo(112L);assertThat(row.get("populationYear")).isEqualTo(114L);});
        assertThat(rows).allSatisfy(row -> { if(number(row,"hospitalCount")+number(row,"clinicCount")>0) assertThat(row.get("medicalYear")).isEqualTo(114L); });
    }
    @Test void migratedLabelsHaveExpectedCounts() {
        try(var session=readSession()) {
            var counts=session.executeRead(tx -> tx.run("MATCH (n) UNWIND labels(n) AS label WITH label,count(*) AS total WHERE label IN ['鄉鎮區碼與名稱','綜合所得','人口與土地','醫療院所統計','醫事人員類別','科別'] RETURN label,total").list());
            Map<String,Long> actual=new HashMap<>(); counts.forEach(row -> actual.put(row.get("label").asString(),row.get("total").asLong()));
            assertThat(actual).containsAllEntriesOf(Map.of("鄉鎮區碼與名稱",368L,"綜合所得",368L,"人口與土地",368L,"醫療院所統計",525L,"醫事人員類別",27L,"科別",45L));
        }
    }
}
