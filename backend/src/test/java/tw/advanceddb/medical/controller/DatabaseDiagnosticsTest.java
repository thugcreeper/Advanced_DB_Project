package tw.advanceddb.medical.controller;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.neo4j.driver.exceptions.AuthenticationException;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith(OutputCaptureExtension.class)
class DatabaseDiagnosticsTest {
    @Test void knownMissingSettingIsVisible() {
        assertThat(DatabaseDiagnostics.describe(new IllegalStateException("缺少環境設定 NEO4J_DATABASE。")))
            .contains("missing=NEO4J_DATABASE");
    }
    @Test void authenticationCodeIsVisibleWithoutServerMessage() {
        assertThat(DatabaseDiagnostics.describe(new AuthenticationException("Neo.ClientError.Security.Unauthorized", "secret-password server-uri")))
            .contains("Neo.ClientError.Security.Unauthorized").doesNotContain("secret-password", "server-uri");
    }
    @Test void nestedNetworkFailureIsVisibleWithoutAddress() {
        assertThat(DatabaseDiagnostics.describe(new IllegalStateException("secret-password", new java.net.UnknownHostException("private-host"))))
            .contains("UnknownHostException").doesNotContain("private-host", "secret-password");
    }
    @Test void handlersLogSafeDiagnosticsAndKeepGenericResponse(CapturedOutput output) {
        var error = new IllegalStateException("secret-password neo4j+s://private-host");
        assertThat(new StatisticsApiErrors().unavailable(error).getStatusCode().value()).isEqualTo(503);
        assertThat(new DistrictApiErrors().unavailable(error).getBody()).containsEntry("code", "DATABASE_UNAVAILABLE");
        new CypherApiErrors().failed(error);
        assertThat(output.getOut()).contains("Data service failure: IllegalStateException").doesNotContain("secret-password", "private-host");
    }
}
