package tw.advanceddb.medical.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

// Source document model; this is not a Neo4j entity or an import operation.
@JsonIgnoreProperties(ignoreUnknown = true)
public record MedicalFacility(
        @JsonProperty("_id") MongoId sourceId,
        String name,
        String address,
        Map<String, ClinicDay> clinicTime,
        List<String> departments,
        Double latitude,
        Double longitude,
        String notes,
        String phone,
        String type,
        GeoLocation location) {

    public record MongoId(@JsonProperty("$oid") String value) {
    }

    public record ClinicDay(boolean isClosed, List<TimeSlot> slots, List<String> open, List<String> close) {
    }

    public record TimeSlot(String open, String close) {
    }

    // GeoJSON order is longitude, latitude; Leaflet uses latitude, longitude.
    public record GeoLocation(String type, List<Double> coordinates) {
    }
}
