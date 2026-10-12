package tw.advanceddb.medical.repository;

import java.util.List;
import java.util.Map;
import java.util.function.IntConsumer;
import org.neo4j.driver.Driver;
import org.neo4j.driver.SessionConfig;
import tw.advanceddb.medical.config.Neo4jConnection;

public final class FacilityImportRepository {
    public static final String DATABASE = Neo4jConnection.DATABASE;
    static final String UPSERT = """
            UNWIND $rows AS row
            MERGE (f:MedicalFacility {sourceId: row.sourceId})
            SET f.name = row.name, f.address = row.address, f.type = row.type,
                f.latitude = row.latitude, f.longitude = row.longitude,
                f.phone = row.phone, f.notes = row.notes,
                f.clinicTimeJson = row.clinicTimeJson, f.source = 'medicalFacilities.json'
            WITH f, row
            OPTIONAL MATCH (f)-[old:HAS_DEPARTMENT]->(:Department)
            DELETE old
            WITH DISTINCT f, row
            FOREACH (name IN row.departments |
                MERGE (d:Department {name: name})
                MERGE (f)-[:HAS_DEPARTMENT]->(d))
            """;
    private final Driver driver;

    public FacilityImportRepository(Driver driver) {
        this.driver = driver;
    }

    public void write(List<Map<String, Object>> rows, IntConsumer committed) {
        try (var session = driver.session(SessionConfig.forDatabase(DATABASE))) {
            session.executeWrite(tx -> {
                tx.run("CREATE CONSTRAINT medical_facility_source_id IF NOT EXISTS FOR (f:MedicalFacility) REQUIRE f.sourceId IS UNIQUE")
                        .consume();
                tx.run("CREATE CONSTRAINT medical_department_name IF NOT EXISTS FOR (d:Department) REQUIRE d.name IS UNIQUE")
                        .consume();
                return null;
            });
            // Each batch commits separately; rerun after interruption using stable source
            // IDs.
            for (int start = 0; start < rows.size(); start += 250) {
                List<Map<String, Object>> batch = rows.subList(start, Math.min(start + 250, rows.size()));
                session.executeWrite(tx -> {
                    tx.run(UPSERT, Map.of("rows", batch)).consume();
                    return null;
                });
                committed.accept(start + batch.size());
            }
        }
    }
}
