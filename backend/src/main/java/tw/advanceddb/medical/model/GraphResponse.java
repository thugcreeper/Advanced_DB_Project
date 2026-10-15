package tw.advanceddb.medical.model;
import java.util.List;
public record GraphResponse(String county, String districtCode, String district, String type, String department,
        int offset, int limit, long total, List<FacilityNode> facilities) {
    public record FacilityNode(String sourceId, String name, String type, List<String> departments) {}
}
