package tw.advanceddb.medical.repository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.neo4j.driver.AccessMode;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.Value;
import org.springframework.stereotype.Repository;
import tw.advanceddb.medical.config.Neo4jConnection;
import tw.advanceddb.medical.model.FacilitySearchResponse.Facility;
import tw.advanceddb.medical.service.FacilityTypeClassifier;

@Repository
public final class DistrictFacilityRepository {
    public record DetailRow(String sourceId, String name, String type, String address, String phone,
            Double latitude, Double longitude, boolean locationReviewRequired, List<String> departments,
            String clinicTimeJson, String notes, String source) {}
    static final String DETAIL = """
            MATCH (f:醫療院所 {sourceId: $sourceId})
            OPTIONAL MATCH (f)-[:HAS_DEPARTMENT]->(d:科別)
            WITH f, d ORDER BY d.科別名稱
            RETURN f{.sourceId, name: f.名稱, type: f.院所類型, address: f.地址, phone: f.電話,
                .clinicTimeJson, notes: f.備註, source: f.資料來源,
                latitude: toFloatOrNull(f.緯度), longitude: toFloatOrNull(f.經度),
                locationReviewRequired: coalesce(f.districtCoordinateConflict, false)} AS facility,
                collect(DISTINCT d.科別名稱) AS departments
            """;
    public record SearchResult(long total, long unassignedTotal, List<Facility> facilities) {}
    static final String SEARCH = """
            MATCH (a:鄉鎮區碼與名稱)-[:HAS_MEDICAL_FACILITIES]->(n:醫療院所)
            WHERE toString(a.鄉鎮市區碼) IN $countyCodes
              AND ($districtCode='' OR toString(a.鄉鎮市區碼)=$districtCode)
              AND (($type='all' AND n.院所類型 IN $allTypes) OR ($type='hospital' AND n.院所類型 IN $hospitalTypes)
                OR ($type='clinic' AND n.院所類型 IN $clinicTypes))
              AND ($department='' OR EXISTS { MATCH (n)-[:HAS_DEPARTMENT]->(:科別 {科別名稱:$department}) })
            WITH DISTINCT n ORDER BY n.名稱, n.sourceId
            RETURN count(n) AS total, collect(n{.sourceId, name: n.名稱, type: n.院所類型, address: n.地址, phone: n.電話,
                latitude: toFloatOrNull(n.緯度), longitude: toFloatOrNull(n.經度),
                locationReviewRequired: coalesce(n.districtCoordinateConflict, false)}) AS facilities
            """;
    static final String UNASSIGNED = """
            MATCH (n:醫療院所) WHERE n.院所類型 IN $allTypes
              AND NOT EXISTS { MATCH (:鄉鎮區碼與名稱)-[:HAS_MEDICAL_FACILITIES]->(n) }
            RETURN count(*) AS total
            """;
    private final Neo4jConnection connection;
    public DistrictFacilityRepository(Neo4jConnection connection) { this.connection = connection; }
    public SearchResult search(List<String> countyCodes, String districtCode, String type, String department) {
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase(connection.database())
                .withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> {
                var parameters=new java.util.HashMap<String,Object>();
                parameters.put("countyCodes",countyCodes);parameters.put("districtCode",districtCode);parameters.put("type",type);parameters.put("department",department);
                parameters.put("hospitalTypes",FacilityTypeClassifier.HOSPITALS);parameters.put("clinicTypes",FacilityTypeClassifier.CLINICS);
                parameters.put("allTypes",java.util.stream.Stream.concat(FacilityTypeClassifier.HOSPITALS.stream(),FacilityTypeClassifier.CLINICS.stream()).toList());
                var result = tx.run(SEARCH, parameters).single();
                long total = result.get("total").asLong();
                List<Facility> facilities = result.get("facilities").asList(value -> new Facility(
                        text(value.get("sourceId")), text(value.get("name")), text(value.get("type")),
                        text(value.get("address")), text(value.get("phone")), number(value.get("latitude")), number(value.get("longitude")),
                        value.get("locationReviewRequired").asBoolean(false)));
                long unassigned = tx.run(UNASSIGNED, parameters).single().get("total").asLong();
                return new SearchResult(total, unassigned, facilities);
            });
        }
    }
    public List<String> departments() {
        try(var session=connection.driver().session(SessionConfig.builder().withDatabase(connection.database()).withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx->tx.run("MATCH (:醫療院所)-[:HAS_DEPARTMENT]->(d:科別) RETURN DISTINCT d.科別名稱 AS name ORDER BY name").list(r->r.get("name").asString()));
        }
    }
    public Optional<DetailRow> detail(String sourceId) {
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase(connection.database())
                .withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> {
                var rows = tx.run(DETAIL, Map.of("sourceId", sourceId)).list();
                if (rows.isEmpty()) return Optional.empty();
                if (rows.size() != 1) throw new IllegalStateException("Duplicate facility sourceId");
                var row = rows.get(0);
                var f = row.get("facility");
                return Optional.of(new DetailRow(text(f.get("sourceId")), text(f.get("name")), text(f.get("type")),
                        text(f.get("address")), text(f.get("phone")), number(f.get("latitude")), number(f.get("longitude")),
                        f.get("locationReviewRequired").asBoolean(false), row.get("departments").asList(Value::asString),
                        text(f.get("clinicTimeJson")), text(f.get("notes")), text(f.get("source"))));
            });
        }
    }
    private static String text(Value value) { return value.isNull() ? "" : value.asString(); }
    private static Double number(Value value) { return value.isNull() ? null : value.asDouble(); }
}
