package tw.advanceddb.medical.service;

import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import tw.advanceddb.medical.model.FacilityDetail.*;

@Component
public final class ClinicHoursParser {
    private static final List<String> DAYS = List.of("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday");
    private final ObjectMapper json;
    public ClinicHoursParser(ObjectMapper json) { this.json = json; }

    public ClinicHours parse(String raw) {
        if (raw == null || raw.isBlank() || raw.equals("null")) return new ClinicHours("missing", List.of());
        if (raw.length() > 131072) return new ClinicHours("invalid", List.of());
        try {
            JsonNode root = json.readTree(raw);
            if (root == null || !root.isObject()) return new ClinicHours("invalid", List.of());
            var days = new ArrayList<Day>();
            boolean invalid = false, available = false;
            for (String key : DAYS) {
                JsonNode day = root.path(key);
                var slots = new ArrayList<Slot>();
                String status = "missing";
                if (!day.isMissingNode() && !day.isNull()) {
                    if (!day.isObject()) invalid = true;
                    else if (day.path("isClosed").isBoolean() && day.path("isClosed").booleanValue()) status = "closed";
                    else {
                        JsonNode values = day.path("slots");
                        if (values.isArray()) {
                            if (values.size() > 24) invalid = true;
                            else for (JsonNode slot : values) {
                                if (valid(slot.path("open"), false) && valid(slot.path("close"), true))
                                    slots.add(new Slot(slot.path("open").asText(), slot.path("close").asText()));
                                else invalid = true;
                            }
                        } else if (!values.isMissingNode() && !values.isNull()) invalid = true;
                        if (slots.isEmpty() && valid(day.path("open"), false) && valid(day.path("close"), true))
                            slots.add(new Slot(day.path("open").asText(), day.path("close").asText()));
                        else if (slots.isEmpty() && (!day.path("open").isNull() && !day.path("open").isMissingNode()
                                || !day.path("close").isNull() && !day.path("close").isMissingNode())) invalid = true;
                        if (!slots.isEmpty()) status = "scheduled";
                    }
                }
                available |= !status.equals("missing");
                days.add(new Day(key, status, List.copyOf(slots)));
            }
            return new ClinicHours(invalid ? (available ? "partial" : "invalid") : available ? "available" : "missing", List.copyOf(days));
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            return new ClinicHours("invalid", List.of());
        }
    }
    private boolean valid(JsonNode value, boolean closing) {
        return value.isTextual() && (value.asText().matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]") || closing && value.asText().equals("24:00"));
    }
}
