package tw.advanceddb.medical.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.*;
import org.neo4j.driver.summary.*;
import tw.advanceddb.medical.config.Neo4jConnection;

class CypherQueryServiceTest {
    @Test void blocksWriteBeforeExecution() {
        var connection = mock(Neo4jConnection.class); var driver = mock(Driver.class);
        when(connection.database()).thenReturn("configured_database");
        var session = mock(Session.class); var tx = mock(Transaction.class);
        var explanation = mock(Result.class); var summary = mock(ResultSummary.class);
        when(connection.driver()).thenReturn(driver); when(driver.session(any(SessionConfig.class))).thenReturn(session);
        when(session.beginTransaction(any(TransactionConfig.class))).thenReturn(tx);
        when(tx.run(eq("EXPLAIN CREATE (:MustNotExist) RETURN 1"), anyMap())).thenReturn(explanation);
        when(explanation.consume()).thenReturn(summary); when(summary.queryType()).thenReturn(QueryType.READ_WRITE);
        var service = new CypherQueryService(connection,new ObjectMapper());
        assertThatThrownBy(()->service.execute(new CypherQueryService.Request("CREATE (:MustNotExist) RETURN 1",Map.of())))
                .isInstanceOf(CypherQueryService.Rejected.class);
        verify(tx,never()).run(eq("CREATE (:MustNotExist) RETURN 1"),anyMap()); verify(tx).close();
        var config = org.mockito.ArgumentCaptor.forClass(SessionConfig.class); verify(driver).session(config.capture());
        assertThat(config.getValue().database()).contains("configured_database");
        assertThat(config.getValue().defaultAccessMode()).isEqualTo(AccessMode.READ);
    }
    @Test void acceptsOnlyExplicitReadProceduresAndRejectsExternalCsv() {
        var plan = mock(Plan.class); when(plan.operatorType()).thenReturn("ProcedureCall"); when(plan.children()).thenReturn(List.of());
        when(plan.arguments()).thenReturn(Map.of("Details",Values.value("db.labels() :: (label :: STRING)")));
        assertThatCode(()->CypherQueryService.inspect(plan)).doesNotThrowAnyException();
        when(plan.arguments()).thenReturn(Map.of("Details",Values.value("apoc.cypher.run()")));
        assertThatThrownBy(()->CypherQueryService.inspect(plan)).isInstanceOf(CypherQueryService.Rejected.class);
        when(plan.operatorType()).thenReturn("LoadCSV");
        assertThatThrownBy(()->CypherQueryService.inspect(plan)).isInstanceOf(CypherQueryService.Rejected.class);
    }
    @Test void functionDetectionIgnoresStringsAndRetainsQuotedNamesAcrossComments() {
        assertThat(CypherQueryService.executableText("RETURN 'apoc.cypher.run()' AS text")).isEqualTo("returnastext");
        assertThat(CypherQueryService.executableText("RETURN `apoc` /* comment */ . cypher.runFirstColumn('x',{},false)"))
                .contains("apoc.cypher.runfirstcolumn(");
        assertThat(CypherQueryService.executableText("RETURN '/*' AS text, apoc.func() // comment\n"))
                .contains("apoc.func(");
    }
}
