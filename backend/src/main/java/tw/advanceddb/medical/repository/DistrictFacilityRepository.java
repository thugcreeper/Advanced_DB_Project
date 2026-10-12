package tw.advanceddb.medical.repository;
import java.util.List;
import java.util.Map;
import org.neo4j.driver.AccessMode;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.Value;
import org.springframework.stereotype.Repository;
import tw.advanceddb.medical.config.Neo4jConnection;
import tw.advanceddb.medical.model.FacilitySearchResponse.Facility;

@Repository
public final class DistrictFacilityRepository {
    public record SearchResult(long total, long unassignedTotal, List<Facility> facilities) {}
    private static final String NORMALIZED_ADDRESS = """
            reduce(address = replace(coalesce(toString(n.address), ''), '台', '臺'),
                space IN [' ', '　', '\\t', '\\r', '\\n'] | replace(address, space, ''))
            """;
    static final String SEARCH = """
            MATCH (n:MedicalFacility)
            WHERE ($type = 'all' AND (n.type CONTAINS '醫院' OR n.type CONTAINS '診所'))
               OR ($type = 'hospital' AND n.type CONTAINS '醫院')
               OR ($type = 'clinic' AND n.type CONTAINS '診所')
            WITH n, %s AS normalizedAddress
            WHERE CASE WHEN trim(coalesce(toString(n.districtCode), '')) <> ''
                THEN replace(trim(coalesce(toString(n.county), '')), '台', '臺') = $county
                    AND ($districtCode = '' OR trim(toString(n.districtCode)) = $districtCode)
                ELSE normalizedAddress =~ $addressPattern END
            WITH n ORDER BY n.name, n.sourceId
            RETURN count(n) AS total, collect(n{.sourceId, .name, .type, .address, .phone,
                latitude: toFloatOrNull(n.latitude), longitude: toFloatOrNull(n.longitude),
                locationReviewRequired: coalesce(n.districtCoordinateConflict, false)}) AS facilities
            """.formatted(NORMALIZED_ADDRESS);
    static final String UNASSIGNED = """
            MATCH (n:MedicalFacility)
            WHERE n.type CONTAINS '醫院' OR n.type CONTAINS '診所'
            WITH n, %s AS normalizedAddress
            WHERE NOT CASE WHEN trim(coalesce(toString(n.districtCode), '')) <> ''
                THEN replace(trim(coalesce(toString(n.county), '')), '台', '臺') + '|'
                    + trim(toString(n.districtCode)) IN $knownDistrictKeys
                ELSE any(prefix IN $knownAddressPrefixes WHERE normalizedAddress STARTS WITH prefix)
                    OR (normalizedAddress =~ '^[0-9０-９].*' AND normalizedAddress =~ $knownAddressPattern) END
            RETURN count(*) AS total
            """.formatted(NORMALIZED_ADDRESS);
    private final Neo4jConnection connection;
    public DistrictFacilityRepository(Neo4jConnection connection) { this.connection = connection; }
    public SearchResult search(String county, String districtCode, String type, String addressPattern,
            String knownAddressPattern, List<String> knownDistrictKeys, List<String> knownAddressPrefixes) {
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase(Neo4jConnection.DATABASE)
                .withDefaultAccessMode(AccessMode.READ).build())) {
            return session.executeRead(tx -> {
                var result = tx.run(SEARCH, Map.of("county", county, "districtCode", districtCode,
                        "type", type, "addressPattern", addressPattern)).single();
                long total = result.get("total").asLong();
                List<Facility> facilities = result.get("facilities").asList(value -> new Facility(
                        text(value.get("sourceId")), text(value.get("name")), text(value.get("type")),
                        text(value.get("address")), text(value.get("phone")), number(value.get("latitude")), number(value.get("longitude")),
                        value.get("locationReviewRequired").asBoolean(false)));
                long unassigned = tx.run(UNASSIGNED, Map.of("knownAddressPattern", knownAddressPattern,
                        "knownDistrictKeys", knownDistrictKeys, "knownAddressPrefixes", knownAddressPrefixes)).single().get("total").asLong();
                return new SearchResult(total, unassigned, facilities);
            });
        }
    }
    private static String text(Value value) { return value.isNull() ? "" : value.asString(); }
    private static Double number(Value value) { return value.isNull() ? null : value.asDouble(); }
}
