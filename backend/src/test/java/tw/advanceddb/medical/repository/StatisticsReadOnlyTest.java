package tw.advanceddb.medical.repository;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.neo4j.driver.*;
import tw.advanceddb.medical.config.Neo4jConnection;

class StatisticsReadOnlyTest {
    @Test void inputsAreParametersAndSessionUsesReadAccessInStatisticsDatabase() {
        var connection = mock(Neo4jConnection.class);
        var driver = mock(Driver.class); var session = mock(Session.class);
        var transaction = mock(TransactionContext.class); var result = mock(Result.class);
        when(connection.driver()).thenReturn(driver); when(driver.session(any(SessionConfig.class))).thenReturn(session);
        when(transaction.run(anyString(),anyMap())).thenReturn(result);
        when(session.executeRead(any(TransactionCallback.class),any(TransactionConfig.class))).thenAnswer(invocation -> {
            TransactionCallback<?> callback=invocation.getArgument(0); return callback.execute(transaction);
        });
        String hostile="' MATCH (n) DELETE n //";
        new DistrictStatisticsRepository(connection).rows(hostile,"內科","clinic");
        var config=ArgumentCaptor.forClass(SessionConfig.class); verify(driver).session(config.capture());
        assertThat(config.getValue().database()).contains("neo4j"); assertThat(config.getValue().defaultAccessMode()).isEqualTo(AccessMode.READ);
        verify(transaction).run(eq(DistrictStatisticsRepository.QUERY),eq(Map.of("personnel",hostile,"specialty","內科","scope","clinic","doctors",java.util.List.of("西醫師","中醫師","牙醫師"))));
        assertThat(DistrictStatisticsRepository.QUERY).doesNotContain(hostile).contains("$personnel","$specialty","$doctors","RECORD_PERSONNEL","PROVIDE_DEPARTMENT","RECORD_MEDICAL_FACILITIES","ir.統計年","pr.統計年");
        assertThat(DistrictStatisticsRepository.QUERY).doesNotContain("CREATE ","MERGE ","DELETE ","SET ");
        verify(session).close();
    }
}
