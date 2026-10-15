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
                for (var type : new String[]{"HAS_FACILITY","HAS_DEPARTMENT","RECORD_DEPARTMENT"}) {
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
