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
@Import({DistrictCatalog.class, DistrictFacilityService.class, ClinicHoursParser.class})
class DistrictSearchTest {
    @Autowired MockMvc mvc;
    @Autowired DistrictCatalog catalog;
    @MockitoBean DistrictFacilityRepository repository;

    @Test void detailReturnsOnlyDatabaseFieldsAndParsedHours() throws Exception {
        when(repository.detail("opaque-id")).thenReturn(java.util.Optional.of(new DistrictFacilityRepository.DetailRow(
                "opaque-id", "測試院所", "醫院", "地址", "02-12345678", 25.0, 121.0, false,
                List.of("內科", "家庭醫學科"), "{\"monday\":{\"isClosed\":true}}", "備註", "source.json")));
        mvc.perform(get("/api/facilities/detail").param("sourceId", "opaque-id"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("測試院所"))
                .andExpect(jsonPath("$.departments[1]").value("家庭醫學科"))
                .andExpect(jsonPath("$.clinicHours.status").value("available"))
                .andExpect(jsonPath("$.clinicHours.days[0].status").value("closed"))
                .andExpect(jsonPath("$.clinicTimeJson").doesNotExist());
    }
    @Test void detailHandlesNotFoundInvalidIdAndDatabaseErrors() throws Exception {
        when(repository.detail("missing")).thenReturn(java.util.Optional.empty());
        mvc.perform(get("/api/facilities/detail").param("sourceId", "missing"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("FACILITY_NOT_FOUND"));
        mvc.perform(get("/api/facilities/detail").param("sourceId", " ")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/facilities/detail")).andExpect(status().isBadRequest());
        verify(repository, never()).detail(" ");
        when(repository.detail("offline")).thenThrow(new IllegalStateException("secret"));
        mvc.perform(get("/api/facilities/detail").param("sourceId", "offline"))
                .andExpect(status().isServiceUnavailable()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))));
    }
    @Test void detailHandlesMissingOptionalFields() throws Exception {
        when(repository.detail("empty")).thenReturn(java.util.Optional.of(new DistrictFacilityRepository.DetailRow(
                "empty", "院所", "診所", "", "", null, null, false, List.of(), "", "", "")));
        mvc.perform(get("/api/facilities/detail").param("sourceId", "empty"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.departments").isEmpty())
                .andExpect(jsonPath("$.clinicHours.status").value("missing"));
    }

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
        when(repository.search(anyList(), eq("1205"), eq("all"), eq(""))).thenReturn(new SearchResult(4, 2, List.of(
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
        when(repository.search(anyList(), anyString(), anyString(), anyString()))
                .thenReturn(new SearchResult(0, 0, List.of()));
        mvc.perform(get("/api/facilities").param("county", "新竹市"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.districtCode").value(""))
                .andExpect(jsonPath("$.type").value("hospital"));
        verify(repository).search(anyList(), eq(""), eq("hospital"), eq(""));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("type", "clinic"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("clinic"));
        mvc.perform(get("/api/facilities").param("county", "不存在的縣市"))
                .andExpect(status().isBadRequest());
    }
    @Test void emptyResultsDifferFromDatabaseFailure() throws Exception {
        when(repository.search(anyList(), anyString(), anyString(), anyString())).thenReturn(new SearchResult(0, 0, List.of()));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("districtCode", "1205"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        when(repository.search(anyList(), anyString(), anyString(), anyString())).thenThrow(new IllegalStateException("private configuration"));
        mvc.perform(get("/api/facilities").param("county", "新竹市").param("districtCode", "1205"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private configuration"))));
    }
    @Test void departmentFiltersUseExactValidatedNames() throws Exception {
        when(repository.departments()).thenReturn(List.of("內科","家庭醫學科"));
        when(repository.search(anyList(),eq("1205"),eq("all"),eq("內科"))).thenReturn(new SearchResult(0,0,List.of()));
        mvc.perform(get("/api/facilities").param("county","新竹市").param("districtCode","1205").param("department","內科"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.department").value("內科"));
        verify(repository).search(anyList(),eq("1205"),eq("all"),eq("內科"));
        mvc.perform(get("/api/facilities").param("county","新竹市").param("department","內科' RETURN 1"))
                .andExpect(status().isBadRequest());
    }
}
