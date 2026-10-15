package tw.advanceddb.medical.config;

import io.github.cdimascio.dotenv.Dotenv;
import jakarta.annotation.PreDestroy;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.springframework.stereotype.Component;

@Component
public final class Neo4jConnection {
    private Driver driver;
    private Dotenv settings;
    private Dotenv settings() {
        if (settings == null) settings = Dotenv.configure().directory(ProjectFiles.backend().toString()).ignoreIfMissing().load();
        return settings;
    }
    public synchronized String database() { return databaseName(settings()); }
    public synchronized Driver driver() {
        if (driver == null) {
            Dotenv config = settings();
            databaseName(config);
            driver = GraphDatabase.driver(required(config, "NEO4J_URI"),
                    AuthTokens.basic(required(config, "NEO4J_USERNAME"), required(config, "NEO4J_PASSWORD")));
        }
        return driver;
    }
    static String databaseName(Dotenv settings) { return required(settings, "NEO4J_DATABASE").strip(); }
    private static String required(Dotenv settings, String key) {
        String value = settings.get(key);
        if (value == null || value.isBlank()) throw new IllegalStateException("請在 backend/.env 填入 " + key + "。");
        return value;
    }
    @PreDestroy
    public synchronized void close() { if (driver != null) driver.close(); }
}
