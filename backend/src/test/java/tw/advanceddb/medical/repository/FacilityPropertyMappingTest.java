package tw.advanceddb.medical.repository;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.*;
import org.neo4j.driver.Record;
import tw.advanceddb.medical.config.Neo4jConnection;
import tw.advanceddb.medical.service.*;

class FacilityPropertyMappingTest {
    final Neo4jConnection connection = mock(Neo4jConnection.class);
    final Driver driver = mock(Driver.class);
    final Session session = mock(Session.class);
    final TransactionContext tx = mock(TransactionContext.class);
    static final String HOURS = "{\"monday\":{\"isClosed\":true}}";
    @BeforeEach @SuppressWarnings("unchecked") void setup() {
        when(connection.database()).thenReturn("test"); when(connection.driver()).thenReturn(driver);
        when(driver.session(any(SessionConfig.class))).thenReturn(session);
        when(session.executeRead(any(TransactionCallback.class))).thenAnswer(i -> ((TransactionCallback<?>) i.getArgument(0)).execute(tx));
        when(session.executeRead(any(TransactionCallback.class), any(TransactionConfig.class)))
            .thenAnswer(i -> ((TransactionCallback<?>) i.getArgument(0)).execute(tx));
    }
    static Map<String,Object> projected() {
        var row = new LinkedHashMap<String,Object>();
        row.put("sourceId", "opaque-id"); row.put("name", "測試院所"); row.put("type", "西醫診所");
        row.put("address", "測試地址"); row.put("phone", "02-12345678"); row.put("latitude", 24.75); row.put("longitude", 120.9);
        row.put("locationReviewRequired", false); row.put("clinicTimeJson", HOURS); row.put("notes", "測試備註"); row.put("source", "來源.json");
        return row;
    }
    static Record row(Map<String,Object> values) {
        var record = mock(Record.class); when(record.get(anyString())).thenAnswer(i -> Values.value(values.get(i.getArgument(0)))); return record;
    }
    @SuppressWarnings("unchecked") static Result result(Record record) {
        var result = mock(Result.class); when(result.single()).thenReturn(record); when(result.list()).thenReturn(List.of(record));
        when(result.list(any(Function.class))).thenAnswer(i -> List.of(((Function<Record,?>) i.getArgument(0)).apply(record)));
        return result;
    }
    static void noLegacyNodeProperties(String query) {
        assertThat(query).doesNotMatch("(?s).*(?:f|n)\\.(?:name|address|phone|latitude|longitude|type|notes|source)\\b.*");
    }
    @Test void searchAndUnassignedUseChinesePropertiesButKeepApiCoordinatesAndTypes() {
        when(tx.run(eq(DistrictFacilityRepository.SEARCH), anyMap())).thenAnswer(i -> result(row(Map.of("total", 1, "facilities", List.of(projected())))));
        when(tx.run(eq(DistrictFacilityRepository.UNASSIGNED), anyMap())).thenAnswer(i -> result(row(Map.of("total", 0))));
        var found = new DistrictFacilityRepository(connection).search(List.of("1205"), "1205", "clinic", "內科");
        assertThat(found.total()).isEqualTo(1); assertThat(found.unassignedTotal()).isZero();
        var facility = found.facilities().get(0);
        assertThat(facility.sourceId()).isEqualTo("opaque-id"); assertThat(facility.name()).isEqualTo("測試院所");
        assertThat(facility.type()).isEqualTo("西醫診所"); assertThat(facility.address()).isEqualTo("測試地址");
        assertThat(facility.phone()).isEqualTo("02-12345678"); assertThat(facility.latitude()).isEqualTo(24.75);
        assertThat(facility.longitude()).isEqualTo(120.9); assertThat(facility.hasLocation()).isTrue();
        noLegacyNodeProperties(DistrictFacilityRepository.SEARCH); noLegacyNodeProperties(DistrictFacilityRepository.UNASSIGNED);
        assertThat(DistrictFacilityRepository.SEARCH).contains("n.院所類型 IN", "ORDER BY n.名稱", "name: n.名稱", "address: n.地址", "phone: n.電話", "toFloatOrNull(n.緯度)", "toFloatOrNull(n.經度)", "HAS_DEPARTMENT", "科別名稱:$department");
        assertThat(DistrictFacilityRepository.UNASSIGNED).contains("n.院所類型 IN", "HAS_MEDICAL_FACILITIES");
    }
    @Test void detailKeepsAllEnglishDtoFieldsAndClinicTimeJsonContents() {
        when(tx.run(eq(DistrictFacilityRepository.DETAIL), anyMap())).thenAnswer(i -> result(row(Map.of("facility", projected(), "departments", List.of("內科")))));
        var repository = new DistrictFacilityRepository(connection);
        var detail = repository.detail("opaque-id").orElseThrow();
        assertThat(detail.clinicTimeJson()).isEqualTo(HOURS); assertThat(detail.notes()).isEqualTo("測試備註"); assertThat(detail.source()).isEqualTo("來源.json");
        var api = new DistrictFacilityService(mock(DistrictCatalog.class), repository, new ClinicHoursParser(new com.fasterxml.jackson.databind.ObjectMapper())).detail("opaque-id");
        var json = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(api);
        for (String field : List.of("sourceId", "name", "address", "phone", "latitude", "longitude", "type", "notes", "source", "clinicHours")) assertThat(json.has(field)).isTrue();
        assertThat(json.has("名稱")).isFalse(); assertThat(json.has("_integrationOwner")).isFalse();
        assertThat(api.clinicHours().status()).isEqualTo("available");
        noLegacyNodeProperties(DistrictFacilityRepository.DETAIL);
        assertThat(DistrictFacilityRepository.DETAIL).contains(".sourceId", ".clinicTimeJson", "name: f.名稱", "type: f.院所類型", "address: f.地址", "phone: f.電話", "notes: f.備註", "source: f.資料來源", "toFloatOrNull(f.緯度)", "toFloatOrNull(f.經度)");
    }
    @Test void missingOptionalValuesStillProduceEmptyTextAndNoMapLocation() {
        var projection = projected(); for (String key : List.of("address", "phone", "latitude", "longitude", "notes", "source")) projection.put(key, null);
        when(tx.run(eq(DistrictFacilityRepository.DETAIL), anyMap())).thenAnswer(i -> result(row(Map.of("facility", projection, "departments", List.of()))));
        var detail = new DistrictFacilityRepository(connection).detail("opaque-id").orElseThrow();
        assertThat(detail.address()).isEmpty(); assertThat(detail.phone()).isEmpty(); assertThat(detail.notes()).isEmpty(); assertThat(detail.source()).isEmpty();
        assertThat(detail.latitude()).isNull(); assertThat(detail.longitude()).isNull();
    }
    @Test void graphUsesChineseFilterAndSortButEnglishAliasesAndStableIds() {
        when(tx.run(anyString(), anyMap())).thenAnswer(i -> {
            String query = i.getArgument(0); noLegacyNodeProperties(query);
            if (query.contains("count(DISTINCT f)")) return result(row(Map.of("total", 1)));
            assertThat(query).contains("ORDER BY f.名稱, f.sourceId", "f.名稱 AS name", "f.院所類型 AS type", "f.sourceId AS id", "HAS_DEPARTMENT");
            return result(row(Map.of("id", "opaque-id", "name", "測試院所", "type", "西醫診所", "departments", List.of("內科"))));
        });
        var page = new GraphRepository(connection).read("1205", List.of("西醫診所"), "內科", 0, 12);
        assertThat(page.total()).isEqualTo(1); assertThat(page.facilities().get(0).name()).isEqualTo("測試院所");
        assertThat(page.facilities().get(0).departments()).containsExactly("內科"); assertThat(GraphRepository.MATCH).contains("f.院所類型 IN $types");
    }
}
