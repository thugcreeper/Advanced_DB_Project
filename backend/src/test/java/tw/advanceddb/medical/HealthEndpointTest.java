package tw.advanceddb.medical;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class HealthEndpointTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void startsWithoutDatabaseCredentialsAndReportsDisconnected() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.databaseConnected").value(false));
    }

    @Test
    void doesNotExposeRawSourceFiles() throws Exception {
        mockMvc.perform(get("/data/medicalFacilities.json"))
                .andExpect(status().isNotFound());
    }
}
