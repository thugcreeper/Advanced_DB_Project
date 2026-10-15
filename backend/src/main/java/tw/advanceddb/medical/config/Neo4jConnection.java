package tw.advanceddb.medical.config;

import io.github.cdimascio.dotenv.Dotenv;
import jakarta.annotation.PreDestroy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.neo4j.driver.*;
import org.springframework.stereotype.Component;

@Component
public final class Neo4jConnection {
    private Driver driver;
    private Dotenv settings;
    private Dotenv settings() {
        if (settings == null) {
            // A packaged service needs only environment variables, not the source tree.
            Path directory = Files.isRegularFile(Path.of("backend/.env")) ? Path.of("backend") : Path.of(".");
            settings = Dotenv.configure().directory(directory.toString()).ignoreIfMissing().load();
        }
        return settings;
    }
    public synchronized String database() { return databaseName(settings()); }
    public synchronized Driver driver() {
        if (driver == null) {
            Dotenv config = settings();
            databaseName(config);
            driver = GraphDatabase.driver(connectionUri(config),
                    AuthTokens.basic(required(config, "NEO4J_USERNAME"), value(config, "NEO4J_PASSWORD", "AURA_PASSWD")),
                    Config.builder().withConnectionTimeout(5, TimeUnit.SECONDS)
                            .withConnectionAcquisitionTimeout(8, TimeUnit.SECONDS)
                            .withMaxTransactionRetryTime(5, TimeUnit.SECONDS)
                            .withMaxConnectionPoolSize(20)
                            .withMaxConnectionLifetime(30, TimeUnit.MINUTES).build());
        }
        return driver;
    }
    static String connectionUri(Dotenv settings) {
        String uri = value(settings, "NEO4J_URI", "AURA_CONNECTION_URI").strip();
        if (!uri.startsWith("neo4j+s://")) throw new IllegalStateException("NEO4J_URI / AURA_CONNECTION_URI 必須使用 neo4j+s:// 加密連線。");
        return uri;
    }
    static String databaseName(Dotenv settings) { return required(settings, "NEO4J_DATABASE").strip(); }
    private static String value(Dotenv settings, String key, String alias) {
        // Explicit process settings take precedence over any local dotenv alias.
        for (String name : new String[]{key, alias}) {
            String value = System.getenv(name);
            if (value != null && !value.isBlank()) return value;
        }
        // Existing Aura dotenv settings supersede retired local NEO4J values.
        String value = settings.get(alias);
        return value == null || value.isBlank() ? required(settings, key) : value;
    }
    private static String required(Dotenv settings, String key) {
        String value = settings.get(key);
        if (value == null || value.isBlank()) throw new IllegalStateException("缺少環境設定 " + key + "。");
        return value;
    }
    @PreDestroy
    public synchronized void close() { if (driver != null) driver.close(); }
}
