package tw.advanceddb.medical.repository;
import java.time.Duration;
import java.util.*;
import org.neo4j.driver.*;
import org.springframework.stereotype.Repository;
import tw.advanceddb.medical.config.Neo4jConnection;
import tw.advanceddb.medical.model.GraphResponse.FacilityNode;
@Repository
public final class GraphRepository {
    private final Neo4jConnection connection;
    public GraphRepository(Neo4jConnection connection) { this.connection = connection; }
    public record Page(long total, List<FacilityNode> facilities) {}
    static final String MATCH = """
        MATCH (a:鄉鎮區碼與名稱)-[:HAS_MEDICAL_FACILITIES]->(f:醫療院所)
        WHERE toString(a.鄉鎮市區碼) = $districtCode AND f.院所類型 IN $types
          AND ($department = '' OR EXISTS {
            MATCH (f)-[:HAS_DEPARTMENT]->(selected:科別) WHERE selected.科別名稱 = $department
          })
        """;
    public Page read(String code, List<String> types, String department, int offset, int limit) {
        try (var session = connection.driver().session(SessionConfig.builder()
                .withDatabase(connection.database()).withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> {
                var params = Map.<String,Object>of("districtCode", code, "types", types, "department", department,
                    "offset", offset, "limit", limit);
                long total = tx.run(MATCH + "RETURN count(DISTINCT f) AS total", params).single().get("total").asLong();
                var rows = tx.run(MATCH + """
                    WITH DISTINCT f ORDER BY f.名稱, f.sourceId SKIP $offset LIMIT $limit
                    OPTIONAL MATCH (f)-[:HAS_DEPARTMENT]->(d:科別)
                    WITH f, d ORDER BY d.科別名稱
                    RETURN f.sourceId AS id, f.名稱 AS name, f.院所類型 AS type,
                           collect(DISTINCT d.科別名稱) AS departments ORDER BY name, id
                    """, params).list(r -> new FacilityNode(r.get("id").asString(), r.get("name").asString("未提供名稱"),
                        r.get("type").asString(""), r.get("departments").asList(Value::asString)));
                return new Page(total, rows);
            }, TransactionConfig.builder().withTimeout(Duration.ofSeconds(10)).build());
        }
    }
}
