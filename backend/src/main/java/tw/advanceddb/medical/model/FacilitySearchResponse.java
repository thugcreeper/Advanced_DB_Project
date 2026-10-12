package tw.advanceddb.medical.model;
import java.util.List;
public record FacilitySearchResponse(String county, String districtCode, String district, String type,
        long total, long unlocatedCount, long unassignedTotal, List<Facility> facilities) {
    public record Facility(String sourceId, String name, String type, String address, String phone,
            Double latitude, Double longitude, boolean locationReviewRequired) {
        public boolean hasLocation() {
            return !locationReviewRequired && latitude != null && longitude != null && Double.isFinite(latitude) && Double.isFinite(longitude)
                    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
        }
    }
}
