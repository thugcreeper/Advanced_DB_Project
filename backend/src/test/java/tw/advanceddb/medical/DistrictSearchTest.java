package tw.advanceddb.medical;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tw.advanceddb.medical.controller.DistrictFacilityController;
import tw.advanceddb.medical.model.FacilitySearchResponse.Facility;
import tw.advanceddb.medical.repository.DistrictFacilityRepository;
import tw.advanceddb.medical.repository.DistrictFacilityRepository.SearchResult;
import tw.advanceddb.medical.service.*;

@WebMvcTest(DistrictFacilityController.class)
@Import({DistrictCatalog.class, DistrictFacilityService.class})
class DistrictSearchTest {
    @Autowired MockMvc mvc;
    @Autowired DistrictCatalog catalog;
    @MockitoBean DistrictFacilityRepository repository;

    @Test void csvContainsUniqueCodesAndCountyGroups() throws Exception {
        var rows = catalog.counties().stream().flatMap(county -> county.districts().stream()).toList();
        assertThat(rows).hasSize(368);
        assertThat(rows.stream().map(row -> row.code()).distinct().count()).isEqualTo(368);
        assertThat(catalog.counties()).hasSize(22);
        assertThat(catalog.require("新竹市", "1205").name()).isEqualTo("香山區");
        assertThat(catalog.require("台北市", "101").county()).isEqualTo("臺北市");
        mvc.perform(get("/api/districts")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(22));
    }
    @Test void rejectsAnotherCountysCodeAndUnknownTypeBeforeQuerying() throws Exception {
        mvc.perform(get("/api/facilities").param("county", "嘉義市").param("districtCode", "1201"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("districtCode", "1205").param("type", "anything"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/facilities")).andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }
    @Test void countsMissingCoordinatesWithoutLosingFacilities() throws Exception {
        when(repository.search(eq("新竹市"), eq("1205"), eq("all"), anyString(), anyString(), anyList(), anyList())).thenReturn(new SearchResult(4, 2, List.of(
                new Facility("1", "A", "醫院", "新竹市香山區", "", 24.75, 120.9, false),
                new Facility("2", "B", "診所", "新竹市香山區", "", null, 120.9, false),
                new Facility("3", "C", "診所", "新竹市香山區", "", 91.0, 120.9, false),
                new Facility("4", "D", "診所", "新竹市香山區", "", 24.75, 120.9, true))));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("districtCode", "1205"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.facilities.length()").value(4)).andExpect(jsonPath("$.unlocatedCount").value(3))
                .andExpect(jsonPath("$.facilities[3].locationReviewRequired").value(true))
                .andExpect(jsonPath("$.unassignedTotal").value(2));
    }
    @Test void countyOnlyDefaultsToHospitalsAndSupportsExplicitType() throws Exception {
        when(repository.search(anyString(), anyString(), anyString(), anyString(), anyString(), anyList(), anyList()))
                .thenReturn(new SearchResult(0, 0, List.of()));
        mvc.perform(get("/api/facilities").param("county", "新竹市"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.districtCode").value(""))
                .andExpect(jsonPath("$.type").value("hospital"));
        verify(repository).search(eq("新竹市"), eq(""), eq("hospital"), anyString(), anyString(), anyList(), anyList());
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("type", "clinic"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("clinic"));
        mvc.perform(get("/api/facilities").param("county", "不存在的縣市"))
                .andExpect(status().isBadRequest());
    }
    @Test void emptyResultsDifferFromDatabaseFailure() throws Exception {
        when(repository.search(anyString(), anyString(), anyString(), anyString(), anyString(), anyList(), anyList())).thenReturn(new SearchResult(0, 0, List.of()));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("districtCode", "1205"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        when(repository.search(anyString(), anyString(), anyString(), anyString(), anyString(), anyList(), anyList())).thenThrow(new IllegalStateException("private configuration"));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("districtCode", "1205"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private configuration"))));
    }
}
