package tw.advanceddb.medical.config;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import io.github.cdimascio.dotenv.Dotenv;
import org.junit.jupiter.api.Test;

class Neo4jConnectionTest {
    @Test void databaseComesFromExplicitSettingWithoutAHardcodedFallback() {
        var settings = mock(Dotenv.class);
        when(settings.get("NEO4J_DATABASE")).thenReturn("configured_database");
        assertThat(Neo4jConnection.databaseName(settings)).isEqualTo("configured_database");
        when(settings.get("NEO4J_DATABASE")).thenReturn(" neo4j ");
        assertThat(Neo4jConnection.databaseName(settings)).isEqualTo("neo4j");
    }
    @Test void missingDatabaseIsAnExplicitConfigurationError() {
        var settings = mock(Dotenv.class);
        for (String value : new String[]{null, "", "   "}) {
            when(settings.get("NEO4J_DATABASE")).thenReturn(value);
            assertThatThrownBy(() -> Neo4jConnection.databaseName(settings))
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("NEO4J_DATABASE");
        }
    }
}
