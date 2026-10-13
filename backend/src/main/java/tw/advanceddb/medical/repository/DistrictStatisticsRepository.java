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
            CALL { WITH d OPTIONAL MATCH (d)-[r:PROVIDE_DEPARTMENT]->(category:科別)
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
            RETURN *
            """;
    public List<Map<String,Object>> rows(String personnel, String specialty, String scope) {
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase("neo4j")
                .withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> tx.run(QUERY, Map.of("personnel", personnel, "specialty", specialty,
                    "scope", scope, "doctors", List.of("西醫師", "中醫師", "牙醫師"))).list(r -> r.asMap()),
                    TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build());
        }
    }
    public Map<String,List<String>> categories() {
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase("neo4j")
                .withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> {
                var personnel = tx.run("MATCH (n:醫事人員類別) WHERE n.人員類別 IS NOT NULL RETURN DISTINCT n.人員類別 AS name ORDER BY name").list(r -> r.get("name").asString());
                var specialties = tx.run("MATCH (n:科別) WHERE n.科別名稱 IS NOT NULL RETURN DISTINCT n.科別名稱 AS name ORDER BY name").list(r -> r.get("name").asString());
                return Map.of("personnel", personnel, "specialties", specialties);
            }, TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build());
        }
    }
}
