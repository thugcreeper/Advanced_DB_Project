package tw.advanceddb.medical.config;

import static org.assertj.core.api.Assertions.*;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.neo4j.driver.*;

@EnabledIfEnvironmentVariable(named="AURA_READ_TESTS", matches="true")
class AuraReadOnlyTest {
    @Test void facilityChinesePropertiesProjectToExistingApiFields() {
        var connection = new Neo4jConnection();
        try {
            var types = java.util.stream.Stream.concat(
                tw.advanceddb.medical.service.FacilityTypeClassifier.HOSPITALS.stream(),
                tw.advanceddb.medical.service.FacilityTypeClassifier.CLINICS.stream()).toList();
            String id, code; java.util.Map<String,Object> properties;
            try (var session = connection.driver().session(SessionConfig.builder().withDatabase(connection.database()).withDefaultAccessMode(AccessMode.READ).build())) {
                var row = session.run("""
                    MATCH (a:鄉鎮區碼與名稱)-[:HAS_MEDICAL_FACILITIES]->(f:醫療院所)
                    WHERE f.院所類型 IN $types AND f.名稱 IS NOT NULL
                    RETURN f.sourceId AS id, toString(a.鄉鎮市區碼) AS code, properties(f) AS properties LIMIT 1
                    """, Map.of("types", types), TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build()).single();
                id = row.get("id").asString(); code = row.get("code").asString(); properties = row.get("properties").asMap();
            }
            assertThat(properties).doesNotContainKeys("name", "address", "phone", "latitude", "longitude", "type", "notes", "source");
            var repository = new tw.advanceddb.medical.repository.DistrictFacilityRepository(connection);
            var detail = repository.detail(id).orElseThrow();
            assertThat(detail.name()).isEqualTo(properties.get("名稱")); assertThat(detail.type()).isEqualTo(properties.get("院所類型"));
            assertThat(detail.address()).isEqualTo(properties.getOrDefault("地址", "")); assertThat(detail.phone()).isEqualTo(properties.getOrDefault("電話", ""));
            assertThat(detail.notes()).isEqualTo(properties.getOrDefault("備註", "")); assertThat(detail.source()).isEqualTo(properties.getOrDefault("資料來源", ""));
            assertThat(detail.clinicTimeJson()).isEqualTo(properties.getOrDefault("clinicTimeJson", ""));
            var search = repository.search(java.util.List.of(code), code, "all", "");
            assertThat(search.facilities()).anySatisfy(f -> { assertThat(f.sourceId()).isEqualTo(id); assertThat(f.name()).isEqualTo(detail.name()); assertThat(f.latitude()).isEqualTo(detail.latitude()); assertThat(f.longitude()).isEqualTo(detail.longitude()); });
            var departments = repository.departments(); assertThat(departments).containsAll(detail.departments());
            var graph = new tw.advanceddb.medical.repository.GraphRepository(connection).read(code, types, "", 0, 12);
            assertThat(graph.total()).isEqualTo(search.total()); assertThat(graph.facilities()).isNotEmpty();
        } finally { connection.close(); }
    }
    @Test void configuredCloudDatabaseContainsRequiredGraph() {
        var connection = new Neo4jConnection();
        try {
            var env = io.github.cdimascio.dotenv.Dotenv.configure().ignoreIfMissing().load();
            var uri = URI.create(Neo4jConnection.connectionUri(env));
            assertThat(uri.getHost().endsWith(".databases.neo4j.io")).isTrue();
            assertThat(connection.database()).isEqualTo(env.get("NEO4J_DATABASE").strip());
            System.out.println("Aura config: TLS=true; cloudHost=true; explicitPort=" + uri.getPort());
            try (var session = connection.driver().session(SessionConfig.builder().withDatabase(connection.database()).withDefaultAccessMode(AccessMode.READ).build())) {
                for (var label : new String[]{"醫療院所","鄉鎮區碼與名稱","科別"}) {
                    var result = session.run("MATCH (n:`" + label + "`) RETURN count(n) AS count", Map.of(),
                        TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build());
                    long count = result.single().get("count").asLong();
                    assertThat(count).isPositive();
                    var summary = result.consume();
                    assertThat(summary.server().address()).doesNotContain("localhost", "127.0.0.1", "[::1]");
                    assertThat(summary.database().name()).isEqualTo(connection.database());
                    System.out.println(label + "=" + count);
                }
                for (var type : new String[]{"HAS_MEDICAL_FACILITIES","HAS_DEPARTMENT","RECORD_DEPARTMENT"}) {
                    long count = session.run("MATCH ()-[r:" + type + "]->() RETURN count(r) AS count").single().get("count").asLong();
                    assertThat(count).isPositive();
                    System.out.println(type + "=" + count);
                }
            }
        } catch (Exception error) {
            if (error instanceof IllegalStateException && (error.getMessage().startsWith("缺少環境設定") || error.getMessage().startsWith("NEO4J_URI /")))
                System.out.println(error.getMessage());
            for (Throwable cause = error; cause != null; cause = cause.getCause())
                System.out.println("Connection diagnostic class=" + cause.getClass().getSimpleName()
                    + (cause instanceof org.neo4j.driver.exceptions.Neo4jException neo ? "; code=" + neo.code() : ""));
            throw new AssertionError("Aura readonly verification failed; see sanitized diagnostic classes (no credentials logged).");
        } finally { connection.close(); }
    }
}
