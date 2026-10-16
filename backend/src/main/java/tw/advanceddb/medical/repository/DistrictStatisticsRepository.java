package tw.advanceddb.medical.repository;

import java.time.Duration;
import java.util.*;
import org.neo4j.driver.*;
import org.springframework.stereotype.Repository;
import tw.advanceddb.medical.config.Neo4jConnection;

@Repository
public class DistrictStatisticsRepository {
    private final Neo4jConnection connection;
    public DistrictStatisticsRepository(Neo4jConnection connection) { this.connection = connection; }
    // Aggregate each relationship family separately to prevent cross-product totals.
    static final String QUERY = """
            MATCH (d:鄉鎮區碼與名稱)
            WHERE ($county='' OR d.鄉鎮市區名稱 STARTS WITH $county)
              AND ($districtCode='' OR toString(d.鄉鎮市區碼)=$districtCode)
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
                    CASE WHEN count(CASE WHEN r.類型='醫院' AND category.人員類別=$personnel THEN r.數量 END)=0 THEN null ELSE sum(CASE WHEN r.類型='醫院' AND category.人員類別=$personnel THEN r.數量 END) END AS hospitalPersonnel,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別 IN $doctors THEN r.數量 ELSE 0 END),0) AS hospitalDoctors,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別='西醫師' THEN r.數量 ELSE 0 END),0) AS hospitalWesternDoctors,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別='中醫師' THEN r.數量 ELSE 0 END),0) AS hospitalChineseDoctors,
                    coalesce(sum(CASE WHEN r.類型='醫院' AND category.人員類別='牙醫師' THEN r.數量 ELSE 0 END),0) AS hospitalDentists,
                    CASE WHEN count(CASE WHEN r.類型='診所' AND category.人員類別=$personnel THEN r.數量 END)=0 THEN null ELSE sum(CASE WHEN r.類型='診所' AND category.人員類別=$personnel THEN r.數量 END) END AS clinicPersonnel,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別 IN $doctors THEN r.數量 ELSE 0 END),0) AS clinicDoctors,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別='西醫師' THEN r.數量 ELSE 0 END),0) AS clinicWesternDoctors,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別='中醫師' THEN r.數量 ELSE 0 END),0) AS clinicChineseDoctors,
                    coalesce(sum(CASE WHEN r.類型='診所' AND category.人員類別='牙醫師' THEN r.數量 ELSE 0 END),0) AS clinicDentists }
            CALL { WITH d
                UNWIND CASE WHEN size($specialties)=0 THEN [{category:'',position:0,min:null,max:null}] ELSE $specialties END AS chosen
                OPTIONAL MATCH (d)-[r:RECORD_DEPARTMENT]->(category:科別)
                WHERE category.科別名稱=chosen.category AND r.類型 IN ['醫院','診所']
                WITH chosen, CASE WHEN count(CASE WHEN r.類型='醫院' THEN r.數量 END)=0 THEN null ELSE sum(CASE WHEN r.類型='醫院' THEN r.數量 END) END AS hospital,
                    CASE WHEN count(CASE WHEN r.類型='診所' THEN r.數量 END)=0 THEN null ELSE sum(CASE WHEN r.類型='診所' THEN r.數量 END) END AS clinic
                WITH chosen, hospital, clinic,
                    CASE $scope WHEN 'hospital' THEN coalesce(hospital,0) WHEN 'clinic' THEN coalesce(clinic,0) ELSE coalesce(hospital,0)+coalesce(clinic,0) END AS selected
                ORDER BY chosen.position
                RETURN collect({category:chosen.category,hospital:hospital,clinic:clinic,total:hospital+clinic,
                    selected:selected,min:chosen.min,max:chosen.max}) AS specialtyRows }
            WITH d.鄉鎮市區名稱 AS name, d.鄉鎮市區碼 AS code,
                i.平均數 AS income, i.中位數 AS medianIncome, ir.統計年 AS incomeYear,
                p.年底人口數 AS population, p.人口密度 AS density, p.土地面積 AS area, pr.統計年 AS populationYear,
                medicalYear, hospitalCount, clinicCount, hospitalStaff, clinicStaff, hospitalStaff+clinicStaff AS staff,
                hospitalPersonnel, clinicPersonnel,
                CASE WHEN $personnel='' THEN [] ELSE [{category:$personnel,hospital:hospitalPersonnel,clinic:clinicPersonnel,total:hospitalPersonnel+clinicPersonnel}] END AS personnelStatistics, specialtyRows,
                head(specialtyRows).hospital AS hospitalSpecialty, head(specialtyRows).clinic AS clinicSpecialty,
                [item IN specialtyRows WHERE item.category<>'' | {category:item.category,hospital:item.hospital,clinic:item.clinic,total:item.total,selected:item.selected}] AS specialties,
                hospitalDoctors, clinicDoctors,
                hospitalWesternDoctors, clinicWesternDoctors, hospitalWesternDoctors+clinicWesternDoctors AS westernDoctors,
                hospitalChineseDoctors, clinicChineseDoctors, hospitalChineseDoctors+clinicChineseDoctors AS chineseDoctors,
                hospitalDentists, clinicDentists, hospitalDentists+clinicDentists AS dentists,
                hospitalDoctors+clinicDoctors AS doctors,
                CASE $scope WHEN 'hospital' THEN coalesce(hospitalPersonnel,0) WHEN 'clinic' THEN coalesce(clinicPersonnel,0) ELSE coalesce(hospitalPersonnel,0)+coalesce(clinicPersonnel,0) END AS personnel,
                CASE WHEN size($specialties)>0 THEN head(specialtyRows).selected ELSE null END AS specialty,
                CASE WHEN p.年底人口數>0 THEN round(10000.0*(hospitalStaff+clinicStaff)/p.年底人口數,2) ELSE null END AS staffRate,
                CASE WHEN p.年底人口數>0 THEN round(10000.0*(hospitalDoctors+clinicDoctors)/p.年底人口數,2) ELSE null END AS doctorRate,
                CASE WHEN p.年底人口數>0 THEN round(10000.0*(hospitalWesternDoctors+clinicWesternDoctors)/p.年底人口數,2) ELSE null END AS westernDoctorRate
            WHERE ($personnel='' OR (personnel>0 AND ($personnelMin IS NULL OR personnel>=$personnelMin) AND ($personnelMax IS NULL OR personnel<=$personnelMax)))
              AND (size($specialties)=0 OR
                CASE $specialtyMatch WHEN 'and' THEN all(item IN specialtyRows WHERE item.selected>0 AND (item.min IS NULL OR item.selected>=item.min) AND (item.max IS NULL OR item.selected<=item.max))
                ELSE any(item IN specialtyRows WHERE item.selected>0 AND (item.min IS NULL OR item.selected>=item.min) AND (item.max IS NULL OR item.selected<=item.max)) END)
              AND ($incomeMin IS NULL OR income>=$incomeMin) AND ($incomeMax IS NULL OR income<=$incomeMax)
              AND ($populationMin IS NULL OR population>=$populationMin) AND ($populationMax IS NULL OR population<=$populationMax)
              AND ($areaMin IS NULL OR area>=$areaMin) AND ($areaMax IS NULL OR area<=$areaMax)
              AND ($hospitalCountMin IS NULL OR hospitalCount>=$hospitalCountMin) AND ($hospitalCountMax IS NULL OR hospitalCount<=$hospitalCountMax)
              AND ($clinicCountMin IS NULL OR clinicCount>=$clinicCountMin) AND ($clinicCountMax IS NULL OR clinicCount<=$clinicCountMax)
            RETURN *
            """;
    public static Map<String,Object> parameters() {
        var p=new LinkedHashMap<String,Object>();
        p.put("county", "");p.put("districtCode", "");p.put("personnel", "");p.put("scope", "all");
        p.put("specialties", List.of());p.put("specialtyMatch", "or");p.put("sort", List.of());
        p.put("doctors", List.of("西醫師","中醫師","牙醫師"));
        for(String key:List.of("income","population","area","hospitalCount","clinicCount","personnel")) {
            p.put(key+"Min",null);p.put(key+"Max",null);
        }
        return p;
    }
    static String orderedQuery(Map<String,Object> parameters) {
        var allowed=Set.of("name","income","population","area","hospitalCount","clinicCount","staff","staffRate","doctors","doctorRate","westernDoctors","chineseDoctors","dentists","westernDoctorRate","personnel","specialty");
        var clauses=new ArrayList<String>();
        for(Object item:(List<?>)parameters.getOrDefault("sort",List.of())) {
            var sort=(Map<?,?>)item;String field=String.valueOf(sort.get("field")),direction=String.valueOf(sort.get("direction"));
            if(!allowed.contains(field)||!Set.of("asc","desc").contains(direction))throw new IllegalArgumentException("無效排序。");
            // Only server-whitelisted identifiers; user values remain parameters.
            clauses.add(field+" IS NULL ASC");clauses.add(field+" "+direction.toUpperCase(Locale.ROOT));
        }
        clauses.add("name ASC");return QUERY+" ORDER BY "+String.join(", ",clauses);
    }
    public List<Map<String,Object>> search(Map<String,Object> parameters) {
        try (var session=connection.driver().session(SessionConfig.builder().withDatabase(connection.database()).withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx->tx.run(orderedQuery(parameters),parameters).list(record->record.asMap()),
                TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build());
        }
    }
    public Map<String,List<String>> categories() {
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase(connection.database())
                .withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> {
                var personnel = tx.run("MATCH (n:醫事人員類別) WHERE n.人員類別 IS NOT NULL RETURN DISTINCT n.人員類別 AS name ORDER BY name").list(r -> r.get("name").asString());
                var specialties = tx.run("MATCH (n:科別) WHERE n.科別名稱 IS NOT NULL AND n._integrationOwner IS NULL RETURN DISTINCT n.科別名稱 AS name ORDER BY name").list(r -> r.get("name").asString());
                return Map.of("personnel", personnel, "specialties", specialties);
            }, TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build());
        }
    }
}
