package tw.advanceddb.medical.config;

import io.github.cdimascio.dotenv.Dotenv;
import jakarta.annotation.PreDestroy;
import java.nio.file.Path;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.springframework.stereotype.Component;

@Component
public final class Neo4jConnection {
    public static final String DATABASE = "medicalfacilities";
    private Driver driver;
    public synchronized Driver driver() {
        if (driver == null) driver = open(ProjectFiles.backend());
        return driver;
    }
    public static Driver open(Path backend) {
        Dotenv settings = Dotenv.configure().directory(backend.toString()).ignoreIfMissing().load();
        String uri = required(settings, "NEO4J_URI");
        String username = required(settings, "NEO4J_USERNAME");
        String password = required(settings, "NEO4J_PASSWORD");
        if (!DATABASE.equals(required(settings, "NEO4J_DATABASE")))
            throw new IllegalStateException("NEO4J_DATABASE 必須是 medicalfacilities。");
        return GraphDatabase.driver(uri, AuthTokens.basic(username, password));
    }
    private static String required(Dotenv settings, String key) {
        String value = settings.get(key);
        if (value == null || value.isBlank()) throw new IllegalStateException("請在 backend/.env 填入 " + key + "。");
        return value;
    }
    @PreDestroy
    public synchronized void close() { if (driver != null) driver.close(); }
}
