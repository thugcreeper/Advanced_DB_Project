package tw.advanceddb.medical.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.neo4j.driver.*;
import tw.advanceddb.medical.config.Neo4jConnection;

class FacilityDatabaseTest {
    @Test void searchDepartmentsAndDetailUseTheConfiguredReadDatabase() {
        var connection = mock(Neo4jConnection.class);
        var driver = mock(Driver.class); var session = mock(Session.class);
        when(connection.database()).thenReturn("configured_database");
        when(connection.driver()).thenReturn(driver); when(driver.session(any(SessionConfig.class))).thenReturn(session);
        var repository = new DistrictFacilityRepository(connection);
        repository.search(List.of("1205"), "1205", "all", "");
        repository.departments(); repository.detail("id");
        var configs = ArgumentCaptor.forClass(SessionConfig.class);
        verify(driver, times(3)).session(configs.capture());
        configs.getAllValues().forEach(config -> {
            assertThat(config.database()).contains("configured_database");
            assertThat(config.defaultAccessMode()).isEqualTo(AccessMode.READ);
        });
        verify(session, times(3)).close();
    }
}
