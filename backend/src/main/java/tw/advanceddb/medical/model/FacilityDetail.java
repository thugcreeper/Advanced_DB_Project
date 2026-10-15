package tw.advanceddb.medical.model;

import java.util.List;

public record FacilityDetail(String sourceId, String name, String type, String address, String phone,
        Double latitude, Double longitude, boolean locationReviewRequired, List<String> departments,
        ClinicHours clinicHours, String notes, String source) {
    public record ClinicHours(String status, List<Day> days) {}
    public record Day(String day, String status, List<Slot> slots) {}
    public record Slot(String open, String close) {}
}
