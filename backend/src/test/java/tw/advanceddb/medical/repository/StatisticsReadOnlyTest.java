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
        when(connection.database()).thenReturn("configured_database");
        var driver = mock(Driver.class); var session = mock(Session.class);
        var transaction = mock(TransactionContext.class); var result = mock(Result.class);
        when(connection.driver()).thenReturn(driver); when(driver.session(any(SessionConfig.class))).thenReturn(session);
        when(transaction.run(anyString(),anyMap())).thenReturn(result);
        when(session.executeRead(any(TransactionCallback.class),any(TransactionConfig.class))).thenAnswer(invocation -> {
            TransactionCallback<?> callback=invocation.getArgument(0); return callback.execute(transaction);
        });
        String hostile="' MATCH (n) DELETE n //";
        var selected=new java.util.LinkedHashMap<String,Object>();selected.put("category","內科");selected.put("position",0);selected.put("min",null);selected.put("max",null);
        var input=DistrictStatisticsRepository.parameters();input.put("personnel",hostile);input.put("scope","clinic");input.put("specialties",java.util.List.of(selected));
        new DistrictStatisticsRepository(connection).search(input);
        var config=ArgumentCaptor.forClass(SessionConfig.class); verify(driver).session(config.capture());
        assertThat(config.getValue().database()).contains("configured_database"); assertThat(config.getValue().defaultAccessMode()).isEqualTo(AccessMode.READ);
        var query=ArgumentCaptor.forClass(String.class);var parameters=ArgumentCaptor.forClass(Map.class);
        verify(transaction).run(query.capture(),parameters.capture());
        assertThat(parameters.getValue()).containsEntry("personnel",hostile).containsEntry("scope","clinic");
        assertThat(parameters.getValue().get("specialties").toString()).contains("內科");
        assertThat(query.getValue()).doesNotContain(hostile).contains("$county","$districtCode","$personnel","$specialties","$specialtyMatch","$incomeMin","$hospitalCountMax","RECORD_PERSONNEL","RECORD_DEPARTMENT","r.類型","item.selected>0","any(item","all(item");
        assertThat(query.getValue()).doesNotContain("CREATE ","MERGE ","DELETE ","SET ","HAS_DEPARTMENT");
        verify(session).close();
    }
    @Test void categoryOptionsUseTheSameConfiguredDatabase() {
        var connection = mock(Neo4jConnection.class);
        var driver = mock(Driver.class); var session = mock(Session.class);
        when(connection.database()).thenReturn("configured_database");
        when(connection.driver()).thenReturn(driver); when(driver.session(any(SessionConfig.class))).thenReturn(session);
        new DistrictStatisticsRepository(connection).categories();
        var config = ArgumentCaptor.forClass(SessionConfig.class); verify(driver).session(config.capture());
        assertThat(config.getValue().database()).contains("configured_database");
        assertThat(config.getValue().defaultAccessMode()).isEqualTo(AccessMode.READ);
    }
    @Test void sortingOnlyUsesServerWhitelistedIdentifiers() {
        var parameters=DistrictStatisticsRepository.parameters();
        parameters.put("sort",java.util.List.of(Map.of("field","population","direction","desc")));
        assertThat(DistrictStatisticsRepository.orderedQuery(parameters)).contains("population DESC");
        parameters.put("sort",java.util.List.of(Map.of("field","name DELETE n","direction","asc")));
        assertThatThrownBy(()->DistrictStatisticsRepository.orderedQuery(parameters)).isInstanceOf(IllegalArgumentException.class);
    }
}
