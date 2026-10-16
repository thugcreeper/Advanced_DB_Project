package tw.advanceddb.medical;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tw.advanceddb.medical.controller.DistrictStatisticsController;
import tw.advanceddb.medical.repository.DistrictStatisticsRepository;
import tw.advanceddb.medical.service.*;

@WebMvcTest(value=DistrictStatisticsController.class, properties="app.cors.allowed-origins=http://127.0.0.1:5500")
@Import({DistrictCatalog.class,DistrictStatisticsService.class})
class StatisticsApiContractTest {
    @Autowired MockMvc mvc;
    @MockitoBean DistrictStatisticsRepository repository;
    @BeforeEach void data() {
        when(repository.categories()).thenReturn(Map.of("personnel",List.of("護理師"),"specialties",List.of("內科")));
        when(repository.search(anyMap())).thenReturn(List.of(row("新竹市東區",200,10000),row("新竹市北區",100,20000),row("新竹市香山區",100,1000),row("嘉義市東區",null,0)));
    }
    private static Map<String,Object> row(String name,Integer income,Integer population) {
        Map<String,Object> row = new HashMap<>();
        row.put("name",name); row.put("income",income); row.put("population",population); row.put("area",10.5);
        row.put("hospitalCount",0L); row.put("clinicCount",2L); row.put("hospitalStaff",3L); row.put("clinicStaff",4L);
        row.put("hospitalDoctors",1L); row.put("clinicDoctors",2L);
        row.put("hospitalWesternDoctors",1L); row.put("clinicWesternDoctors",2L);
        row.put("hospitalChineseDoctors",0L); row.put("clinicChineseDoctors",0L);
        row.put("hospitalDentists",0L); row.put("clinicDentists",0L); row.put("personnel",2L); row.put("specialty",1L); row.put("specialties",List.of(Map.of("category","內科","hospital",1L,"clinic",0L,"total",1L,"selected",1L)));
        return row;
    }
    private org.springframework.test.web.servlet.ResultActions search(String body) throws Exception {
        return mvc.perform(post("/api/districts/statistics/search").contentType(MediaType.APPLICATION_JSON).content(body));
    }
    @Test void optionsExposeScopedBoundsAndCategories() throws Exception {
        mvc.perform(get("/api/districts/statistics/options").param("county","新竹市"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bounds.population.min").value(1000))
            .andExpect(jsonPath("$.bounds.population.max").value(20000)).andExpect(jsonPath("$.personnel[0]").value("護理師"));
    }
    @Test void countyIncomeSearchUsesJsonBodyAndReturnsAllThreeHsinchuDistricts() throws Exception {
        search("{\"county\":\"新竹市\",\"income\":{\"min\":100}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(3))
            .andExpect(jsonPath("$.districts[*].name", org.hamcrest.Matchers.containsInAnyOrder("東區","北區","香山區")));
    }
    @Test void invalidInputsFailBeforeReadingDatabase() throws Exception {
        for (String body:List.of("{\"population\":{\"min\":20000,\"max\":100}}","{\"population\":{\"min\":-1}}","{\"population\":{\"min\":0.5}}","{\"income\":{\"min\":\"bad\"}}","{\"sort\":[{\"field\":\"DELETE\",\"direction\":\"asc\"}]}")) search(body).andExpect(status().isBadRequest());
        verify(repository,never()).search(anyMap());
    }
    @Test void unlistedOriginIsRejected() throws Exception {
        mvc.perform(options("/api/districts/statistics/search").header("Origin","https://untrusted.example")
            .header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
    }
    @Test void localFrontendMayPreflightPostSearch() throws Exception {
        mvc.perform(options("/api/districts/statistics/search").header("Origin","http://127.0.0.1:5500")
            .header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","content-type"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Methods",org.hamcrest.Matchers.containsString("POST")));
    }
    @Test void districtCodeDoesNotIncludeAnotherCountysSameNamedDistrict() throws Exception {
        search("{\"county\":\"新竹市\",\"districtCode\":\"1201\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.districts[0].county").value("新竹市"));
        search("{\"county\":\"嘉義市\",\"districtCode\":\"1201\"}").andExpect(status().isBadRequest());
    }
    @Test void missingIncomeIsNotZeroAndZeroPopulationCannotProduceRate() throws Exception {
        search("{\"income\":{\"min\":0}}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(3));
        search("{\"county\":\"嘉義市\"}").andExpect(status().isOk()).andExpect(jsonPath("$.districts[0].income").doesNotExist())
            .andExpect(jsonPath("$.districts[0].doctorRate").doesNotExist());
        assertThat(DistrictStatisticsService.rate(1096,43703)).isEqualTo(250.78);
        assertThat(DistrictStatisticsService.rate(1,null)).isNull();
        assertThat(DistrictStatisticsService.rate(1,0)).isNull();
    }
    @Test void andEqualBoundsAndEmptyResults() throws Exception {
        search("{\"county\":\"新竹市\",\"income\":{\"min\":100,\"max\":100},\"population\":{\"min\":1000,\"max\":1000},\"hospitals\":{\"max\":0}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.districts[0].name").value("香山區"));
        search("{\"population\":{\"min\":99999999}}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
    }
    @Test void categoryAndScopeAreValidatedAndPassedAsParameters() throws Exception {
        search("{\"personnel\":{\"category\":\"護理師\",\"scope\":\"clinic\",\"count\":{\"min\":2}}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.districts[0].staff").value(7));
        verify(repository).search(argThat(parameters->"護理師".equals(parameters.get("personnel"))&&"clinic".equals(parameters.get("scope"))&&Double.valueOf(2).equals(parameters.get("personnelMin"))));
        search("{\"personnel\":{\"category\":\"不存在\"}}").andExpect(status().isBadRequest());
    }
    @Test void failureIsNotEmptyResultsAndDetailsStayPrivate() throws Exception {
        when(repository.search(anyMap())).thenThrow(new IllegalStateException("private secret"));
        search("{}").andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private secret"))));
    }
    @Test void distinctDoctorCategoriesKeepThreeCategoryTotalMeaning() throws Exception {
        var doctors=row("新竹市東區",100,10000);
        doctors.put("hospitalWesternDoctors",5L); doctors.put("clinicWesternDoctors",2L);
        doctors.put("hospitalChineseDoctors",3L); doctors.put("clinicChineseDoctors",1L);
        doctors.put("hospitalDentists",4L); doctors.put("clinicDentists",2L);
        doctors.put("hospitalDoctors",12L); doctors.put("clinicDoctors",5L);
        when(repository.search(anyMap())).thenReturn(List.of(doctors));
        search("{}").andExpect(status().isOk()).andExpect(jsonPath("$.districts[0].doctors").value(17))
            .andExpect(jsonPath("$.districts[0].westernDoctors").value(7)).andExpect(jsonPath("$.districts[0].chineseDoctors").value(4))
            .andExpect(jsonPath("$.districts[0].dentists").value(6)).andExpect(jsonPath("$.districts[0].westernDoctorRate").value(7));
    }
    @Test void missingPopulationAreaAndTotalsAreHandledWithoutInventingValues() throws Exception {
        var missing = row("新竹市東區",null,null);
        missing.put("area",null); missing.put("hospitalStaff",null); missing.put("clinicStaff",null);
        when(repository.search(anyMap())).thenReturn(List.of(missing));
        search("{}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.districts[0].population").doesNotExist()).andExpect(jsonPath("$.districts[0].area").doesNotExist())
            .andExpect(jsonPath("$.districts[0].staffRate").doesNotExist()).andExpect(jsonPath("$.districts[0].staff").value(0));
        search("{\"area\":{\"min\":0}}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
    }

    @Test void selectedCategoryExcludesZeroAndMissingCountsInEveryScope() throws Exception {
        var zero=row("新竹市東區",200,10000);zero.put("specialty",0L);zero.put("specialties",List.of(Map.of("category","內科","selected",0)));
        var positive=row("新竹市北區",100,20000);positive.put("specialty",2L);positive.put("specialties",List.of(Map.of("category","內科","selected",2)));
        var missing=row("新竹市香山區",100,1000);missing.remove("specialty");missing.put("specialties",List.of());
        when(repository.search(anyMap())).thenReturn(List.of(zero,positive,missing));
        for(String scope:List.of("all","hospital","clinic")) {
            String body="{\"county\":\"新竹市\",\"specialty\":{\"category\":\"內科\",\"scope\":\""+scope+"\"}}";
            search(body).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.districts[0].name").value("北區"));
        }
        search("{\"specialty\":{\"category\":\"內科\",\"count\":{\"min\":0}}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        search("{\"specialty\":{\"category\":\"內科\",\"count\":{\"min\":3}}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        search("{}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(3));
    }
    @Test void bothSelectedCategoriesMustBePositiveButHospitalPresenceIsNotRequired() throws Exception {
        var both=row("新竹市東區",200,10000);
        var noPersonnel=row("新竹市北區",100,20000);noPersonnel.put("personnel",0L);
        var noSpecialty=row("新竹市香山區",100,1000);noSpecialty.put("specialty",0L);noSpecialty.put("specialties",List.of(Map.of("category","內科","selected",0)));
        when(repository.search(anyMap())).thenReturn(List.of(both,noPersonnel,noSpecialty));
        search("{\"personnel\":{\"category\":\"護理師\",\"scope\":\"all\"},\"specialty\":{\"category\":\"內科\",\"scope\":\"all\"}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.districts[0].hospitalCount").value(0));
        search("{\"personnel\":{\"category\":\"護理師\"}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
    }

    @Test void multipleDepartmentsApplyOrAndWithoutAddingDepartmentCounts() throws Exception {
        when(repository.categories()).thenReturn(Map.of("personnel",List.of("護理師"),"specialties",List.of("內科","外科")));
        var one=row("新竹市東區",200,10000);one.put("specialties",List.of(Map.of("category","內科","selected",2),Map.of("category","外科","selected",0)));
        var both=row("新竹市北區",100,20000);both.put("specialties",List.of(Map.of("category","內科","selected",1),Map.of("category","外科","selected",3)));
        var none=row("新竹市香山區",100,1000);none.put("specialties",List.of(Map.of("category","內科","selected",0),Map.of("category","外科","selected",0)));
        when(repository.search(anyMap())).thenReturn(List.of(one,both,none));
        String parts="\"specialties\":[{\"category\":\"內科\",\"scope\":\"clinic\"},{\"category\":\"外科\",\"scope\":\"clinic\"}]";
        search("{"+parts+",\"specialtyMatch\":\"or\"}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        search("{"+parts+",\"specialtyMatch\":\"and\"}").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        var params=org.mockito.ArgumentCaptor.forClass(Map.class);verify(repository,atLeastOnce()).search(params.capture());
        assertThat(params.getValue()).containsEntry("scope","clinic").containsEntry("specialtyMatch","and");
        assertThat((List<?>)params.getValue().get("specialties")).hasSize(2);
    }
    @Test void fullRequestReachesRepositoryAndInvalidMultiSelectionsAreRejected() throws Exception {
        search("{\"county\":\"新竹市\",\"districtCode\":\"1201\",\"income\":{\"min\":10},\"population\":{\"min\":1,\"max\":50000},\"area\":{\"max\":20},\"hospitals\":{\"max\":2},\"clinics\":{\"min\":1},\"personnel\":{\"category\":\"護理師\",\"scope\":\"clinic\",\"count\":{\"min\":1}},\"specialties\":[{\"category\":\"內科\",\"scope\":\"clinic\"}],\"sort\":[{\"field\":\"population\",\"direction\":\"asc\"}]}")
          .andExpect(status().isOk()).andExpect(jsonPath("$.appliedFilters.county").value("新竹市"));
        var params=org.mockito.ArgumentCaptor.forClass(Map.class);verify(repository).search(params.capture());
        assertThat(params.getValue()).containsEntry("county","新竹市").containsEntry("districtCode","1201").containsEntry("incomeMin",10.0).containsEntry("populationMax",50000.0).containsEntry("areaMax",20.0).containsEntry("hospitalCountMax",2.0).containsEntry("clinicCountMin",1.0).containsEntry("personnelMin",1.0);
        for(String body:List.of("{\"specialties\":[null]}","{\"specialties\":[{\"category\":\"內科\"},{\"category\":\"內科\"}]}","{\"specialtyMatch\":\"bad\"}","{\"specialties\":[{\"category\":\"不存在\"}]}"))search(body).andExpect(status().isBadRequest());
    }
}
