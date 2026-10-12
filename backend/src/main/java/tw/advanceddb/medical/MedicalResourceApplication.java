package tw.advanceddb.medical;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.neo4j.Neo4jAutoConfiguration;

@SpringBootApplication(exclude = Neo4jAutoConfiguration.class)
public class MedicalResourceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MedicalResourceApplication.class, args);
    }
}
