package tw.advanceddb.medical.repository;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import tw.advanceddb.medical.config.Neo4jConnection;
import tw.advanceddb.medical.service.DistrictCatalog;
@EnabledIfEnvironmentVariable(named="AURA_READ_TESTS",matches="true")
class StatisticsAuraReadOnlyTest {
    private static Map<String,Object> selected(String name,int position) {
        var item=new LinkedHashMap<String,Object>();item.put("category",name);item.put("position",position);item.put("min",1);item.put("max",null);return item;
    }
    @Test void cypherItselfFiltersGovernmentDepartmentTypesBeforeService() {
        var connection=new Neo4jConnection();
        try {
            var repository=new DistrictStatisticsRepository(connection);var parameters=DistrictStatisticsRepository.parameters();
            parameters.put("county","臺南市");parameters.put("specialties",List.of(selected("中醫婦科",0)));
            var rows=repository.search(parameters);
            assertThat(rows).allSatisfy(row->{assertThat((String)row.get("name")).startsWith("臺南市");assertThat(((Number)row.get("specialty")).longValue()).isPositive();});
            var north=rows.stream().filter(row->row.get("name").equals("臺南市北區")).findFirst().orElseThrow();
            assertThat(((Number)north.get("hospitalSpecialty")).longValue()).isEqualTo(1);
            assertThat(((Number)north.get("clinicSpecialty")).longValue()).isEqualTo(4);
            assertThat(((Number)north.get("specialty")).longValue()).isEqualTo(5);
            var east=rows.stream().filter(row->row.get("name").equals("臺南市東區")).findFirst().orElseThrow();assertThat(((Number)east.get("clinicSpecialty")).longValue()).isEqualTo(7);
            parameters.put("scope","hospital");assertThat(repository.search(parameters)).hasSize(1).allSatisfy(row->assertThat(row.get("name")).isEqualTo("臺南市北區"));
            parameters.put("scope","clinic");assertThat(repository.search(parameters)).allSatisfy(row->assertThat(((Number)row.get("clinicSpecialty")).longValue()).isPositive());
            parameters.put("personnel","護理師");parameters.put("personnelMin",1000000);assertThat(repository.search(parameters)).isEmpty();
        } finally {connection.close();}
    }
    @Test void cypherItselfAppliesOrAndDistrictRangesAndOrdering() {
        var connection=new Neo4jConnection();
        try {
            var repository=new DistrictStatisticsRepository(connection);var parameters=DistrictStatisticsRepository.parameters();parameters.put("county","臺南市");parameters.put("specialties",List.of(selected("中醫婦科",0),selected("內科",1)));
            var or=repository.search(parameters);parameters.put("specialtyMatch","and");var and=repository.search(parameters);assertThat(or.size()).isGreaterThan(and.size());
            assertThat(and).allSatisfy(row->{for(Object value:(List<?>)row.get("specialties"))assertThat(((Number)((Map<?,?>)value).get("selected")).longValue()).isPositive();});
            String code=new DistrictCatalog().counties().stream().filter(c->c.name().equals("臺南市")).flatMap(c->c.districts().stream()).filter(d->d.name().equals("北區")).findFirst().orElseThrow().code();
            parameters.put("districtCode",code);assertThat(repository.search(parameters)).hasSize(1);parameters.put("incomeMin",1000000);assertThat(repository.search(parameters)).isEmpty();parameters.put("incomeMin",null);parameters.put("districtCode","");parameters.put("populationMax",1);assertThat(repository.search(parameters)).isEmpty();
            parameters.put("populationMax",null);parameters.put("sort",List.of(Map.of("field","population","direction","asc")));var sorted=repository.search(parameters).stream().map(row->((Number)row.get("population")).doubleValue()).toList();assertThat(sorted).isSorted();
        } finally {connection.close();}
    }
    @Test void selectedPersonnelBreakdownUsesRecordsAndMissingDepartmentRemainsNull() {
        var connection=new Neo4jConnection();
        try {
            var repository=new DistrictStatisticsRepository(connection);var parameters=DistrictStatisticsRepository.parameters();
            parameters.put("county","新竹縣");parameters.put("personnel","護理師");
            var row=repository.search(parameters).stream().filter(r->r.get("name").equals("新竹縣竹北市")).findFirst().orElseThrow();
            var actual=(Map<?,?>)((List<?>)row.get("personnelStatistics")).get(0);
            var raw=new HashMap<String,Long>();
            try(var session=connection.driver().session(org.neo4j.driver.SessionConfig.builder().withDatabase(connection.database()).withDefaultAccessMode(org.neo4j.driver.AccessMode.READ).build())){
                var records=session.run("MATCH (d:鄉鎮區碼與名稱)-[r:RECORD_PERSONNEL]->(p:醫事人員類別) WHERE d.鄉鎮市區名稱=$name AND p.人員類別=$person RETURN r.類型 AS type,sum(r.數量) AS count",Map.of("name","新竹縣竹北市","person","護理師")).list();
                records.forEach(r->raw.put(r.get("type").asString(),r.get("count").asLong()));
            }
            assertThat(((Number)actual.get("hospital")).longValue()).isEqualTo(raw.get("醫院"));
            assertThat(((Number)actual.get("clinic")).longValue()).isEqualTo(raw.get("診所"));
            assertThat(((Number)actual.get("total")).longValue()).isEqualTo(raw.get("醫院")+raw.get("診所"));
            parameters=DistrictStatisticsRepository.parameters();parameters.put("county","臺南市");parameters.put("specialties",List.of(selected("中醫婦科",0)));
            row=repository.search(parameters).stream().filter(r->r.get("name").equals("臺南市東區")).findFirst().orElseThrow();
            actual=(Map<?,?>)((List<?>)row.get("specialties")).get(0);
            assertThat(actual.get("hospital")).isNull();assertThat(actual.get("total")).isNull();
            assertThat(((Number)actual.get("clinic")).longValue()).isEqualTo(7);
            assertThat(((Number)actual.get("selected")).longValue()).isEqualTo(7);
        } finally {connection.close();}
    }
}
