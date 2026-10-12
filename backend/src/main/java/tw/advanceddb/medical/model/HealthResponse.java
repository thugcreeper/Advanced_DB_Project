package tw.advanceddb.medical.model;

public record HealthResponse(String status, String application, boolean databaseConnected) {
}
