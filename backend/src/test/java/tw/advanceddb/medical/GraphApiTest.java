package tw.advanceddb.medical;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tw.advanceddb.medical.controller.GraphController;
import tw.advanceddb.medical.model.GraphResponse.FacilityNode;
import tw.advanceddb.medical.repository.GraphRepository;
import tw.advanceddb.medical.service.*;
@WebMvcTest(GraphController.class)
@Import({DistrictCatalog.class,GraphService.class})
class GraphApiTest {
    @Autowired MockMvc mvc;
    @Autowired GraphService service;
    @MockitoBean GraphRepository repository;
    @Test void requiresDistrictAndRejectsCrossCountyAndUnboundedRequests() throws Exception {
        mvc.perform(get("/api/graph/facilities").param("county","新竹市")).andExpect(status().isBadRequest());
        for (String code : List.of("", "101"))
            mvc.perform(get("/api/graph/facilities").param("county","新竹市").param("districtCode",code)).andExpect(status().isBadRequest());
        for (int limit : new int[]{0,25,1000})
            assertThatThrownBy(()->service.read("新竹市","1205","all","",0,limit)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->service.read("新竹市","1205","all","",-1,12)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->service.read("新竹市","1205","wrong","",0,12)).isInstanceOf(IllegalArgumentException.class);
        mvc.perform(get("/api/graph/facilities").param("county","新竹市").param("districtCode","1205").param("limit","bad")).andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }
    @Test void returnsPagedRelationshipsAndUsesSelectedTypeAndDepartment() throws Exception {
        when(repository.read("1205",FacilityTypeClassifier.CLINICS,"內科",12,12)).thenReturn(new GraphRepository.Page(25,
            List.of(new FacilityNode("source-id","同名院所","西醫診所",List.of("內科","家庭醫學科")))));
        mvc.perform(get("/api/graph/facilities").param("county","新竹市").param("districtCode","1205")
            .param("type","clinic").param("department","內科").param("offset","12"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(25))
            .andExpect(jsonPath("$.district").value("香山區")).andExpect(jsonPath("$.offset").value(12))
            .andExpect(jsonPath("$.facilities[0].sourceId").value("source-id"))
            .andExpect(jsonPath("$.facilities[0].departments.length()").value(2));
        verify(repository).read("1205",FacilityTypeClassifier.CLINICS,"內科",12,12);
    }
    @Test void databaseErrorsStaySeparateAndDoNotExposeDetails() throws Exception {
        when(repository.read(anyString(),anyList(),anyString(),anyInt(),anyInt())).thenThrow(new IllegalStateException("private-password"));
        mvc.perform(get("/api/graph/facilities").param("county","新竹市").param("districtCode","1205"))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-password"))));
    }
}
