package tw.advanceddb.medical.controller;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.exceptions.ClientException;

class CypherApiErrorsTest {
    @Test void hidesDriverDetailsInSyntaxErrors() {
        var reply = new CypherApiErrors().database(new ClientException("Neo.ClientError.Statement.SyntaxError", "password secret bolt://server C:\\private"));
        assertThat(reply.getStatusCode().value()).isEqualTo(400);
        assertThat(reply.getBody().get("message")).doesNotContain("password", "bolt:", "private");
    }
    @Test void distinguishesTimeoutAndPermission() {
        var errors = new CypherApiErrors();
        assertThat(errors.database(new ClientException("Neo.ClientError.Transaction.TransactionTimedOut", "internal")).getStatusCode().value()).isEqualTo(408);
        assertThat(errors.database(new ClientException("Neo.ClientError.Security.Forbidden", "internal")).getStatusCode().value()).isEqualTo(403);
    }
    @Test void hidesUnexpectedServiceErrors() {
        var reply = new CypherApiErrors().failed(new IllegalStateException("secret internal path"));
        assertThat(reply.getStatusCode().value()).isEqualTo(503);
        assertThat(reply.getBody().get("message")).doesNotContain("secret", "path");
    }
}
