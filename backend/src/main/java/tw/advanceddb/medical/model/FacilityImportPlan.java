package tw.advanceddb.medical.model;

import java.util.List;
import java.util.Map;

public record FacilityImportPlan(int sourceCount, List<Map<String, Object>> rows,
        Map<String, Integer> typeCounts, int departmentCount, int relationshipCount,
        int errorCount, List<String> errors) {
    public boolean valid() {
        return errorCount == 0 && sourceCount > 0;
    }
}
