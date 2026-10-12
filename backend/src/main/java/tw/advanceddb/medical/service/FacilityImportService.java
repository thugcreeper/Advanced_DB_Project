package tw.advanceddb.medical.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import tw.advanceddb.medical.model.FacilityImportPlan;
import tw.advanceddb.medical.model.MedicalFacility;

public final class FacilityImportService {
    private final ObjectMapper mapper = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    public FacilityImportPlan inspect(Path file) throws IOException {
        List<MedicalFacility> facilities = mapper.readValue(file.toFile(), new TypeReference<>() {});
        if (facilities == null) {
            throw new IOException("JSON 根節點必須是陣列，不能是 null。");
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        Set<String> departments = new HashSet<>();
        Map<String, Integer> types = new TreeMap<>();
        int errorCount = 0;
        int relationshipCount = 0;
        for (int index = 0; index < facilities.size(); index++) {
            MedicalFacility facility = facilities.get(index);
            List<String> problems = new ArrayList<>();
            if (facility == null) {
                problems.add("資料不能是 null");
            } else {
                String id = facility.sourceId() == null ? null : facility.sourceId().value();
                if (blank(id)) problems.add("缺少 _id.$oid");
                else if (!ids.add(id)) problems.add("重複的 _id.$oid");
                if (blank(facility.name())) problems.add("缺少名稱");
                if (blank(facility.address())) problems.add("缺少地址");
                if (blank(facility.type())) problems.add("缺少類型");
                if (!coordinate(facility.latitude(), -90, 90)
                        || !coordinate(facility.longitude(), -180, 180)) {
                    problems.add("經緯度缺漏或超出範圍");
                }
                var location = facility.location();
                if (location == null || !"Point".equals(location.type())
                        || location.coordinates() == null || location.coordinates().size() != 2
                        || !same(location.coordinates().get(0), facility.longitude())
                        || !same(location.coordinates().get(1), facility.latitude())) {
                    problems.add("GeoJSON 與經緯度不一致");
                }
                if (facility.departments() == null || facility.departments().stream().anyMatch(FacilityImportService::blank)) {
                    problems.add("科別必須是陣列且不得含空白項目");
                }
                if (problems.isEmpty()) {
                    List<String> specialties = facility.departments().stream().map(String::trim).distinct().sorted().toList();
                    departments.addAll(specialties);
                    relationshipCount += specialties.size();
                    types.merge(facility.type(), 1, Integer::sum);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("sourceId", id);
                    row.put("name", facility.name());
                    row.put("address", facility.address());
                    row.put("type", facility.type());
                    row.put("latitude", facility.latitude());
                    row.put("longitude", facility.longitude());
                    row.put("phone", facility.phone() == null ? "" : facility.phone());
                    row.put("notes", facility.notes() == null ? "" : facility.notes());
                    // Neo4j properties cannot contain nested objects; preserve opening times as JSON.
                    row.put("clinicTimeJson", mapper.writeValueAsString(facility.clinicTime()));
                    row.put("departments", specialties);
                    rows.add(row);
                }
            }
            if (!problems.isEmpty()) {
                errorCount++;
                if (errors.size() < 20) errors.add("第 " + (index + 1) + " 筆：" + String.join("、", problems));
            }
        }
        if (facilities.isEmpty()) {
            errorCount++;
            errors.add("來源資料為空，不執行匯入。");
        }
        return new FacilityImportPlan(facilities.size(), List.copyOf(rows), Map.copyOf(types),
                departments.size(), relationshipCount, errorCount, List.copyOf(errors));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean coordinate(Double value, double min, double max) {
        return value != null && Double.isFinite(value) && value >= min && value <= max;
    }

    private static boolean same(Double left, Double right) {
        return left != null && right != null && Double.isFinite(left) && Double.isFinite(right)
                && Math.abs(left - right) < 0.000001;
    }
}
