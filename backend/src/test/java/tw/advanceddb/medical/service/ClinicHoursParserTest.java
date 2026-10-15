package tw.advanceddb.medical.service;

import static org.assertj.core.api.Assertions.assertThat;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ClinicHoursParserTest {
    private final ClinicHoursParser parser = new ClinicHoursParser(new ObjectMapper());
    @Test void readsMultipleSlotsAndExplicitClosureWithoutGuessingOtherDays() {
        var result = parser.parse("""
                {"monday":{"isClosed":false,"slots":[{"open":"08:00","close":"12:00"},{"open":"18:00","close":"21:30"}]},
                 "sunday":{"isClosed":true,"slots":[]}}
                """);
        assertThat(result.status()).isEqualTo("available");
        assertThat(result.days()).hasSize(7);
        assertThat(result.days().get(0).slots()).hasSize(2);
        assertThat(result.days().get(1).status()).isEqualTo("missing");
        assertThat(result.days().get(6).status()).isEqualTo("closed");
    }
    @Test void supportsLegacySingleSlotAndMidnightClosing() {
        var result = parser.parse("{\"monday\":{\"open\":\"18:00\",\"close\":\"24:00\"}}");
        assertThat(result.days().get(0).slots().get(0).close()).isEqualTo("24:00");
    }
    @Test void handlesAbsentAndMalformedJsonWithoutLeakingRawContent() {
        for (String raw : new String[]{null, "", "{}", "null", "{\"monday\":{\"isClosed\":false,\"slots\":[]}}"})
            assertThat(parser.parse(raw).status()).isEqualTo("missing");
        for (String raw : new String[]{"not json", "[]", "{\"monday\":42}", "x".repeat(131073)})
            assertThat(parser.parse(raw).status()).isEqualTo("invalid");
    }
    @Test void rejectsInvalidTimesAndKeepsValidPartialData() {
        var result = parser.parse("{\"monday\":{\"slots\":[{\"open\":\"99:00\",\"close\":\"12:00\"},{\"open\":\"09:00\",\"close\":\"12:00\"}]}}");
        assertThat(result.status()).isEqualTo("partial");
        assertThat(result.days().get(0).slots()).hasSize(1);
    }
}
