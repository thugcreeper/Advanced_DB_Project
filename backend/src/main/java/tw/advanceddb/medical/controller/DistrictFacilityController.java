package tw.advanceddb.medical.controller;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import tw.advanceddb.medical.model.FacilitySearchResponse;
import tw.advanceddb.medical.service.DistrictCatalog;
import tw.advanceddb.medical.service.DistrictFacilityService;

@RestController
@RequestMapping("/api")
public class DistrictFacilityController {
    private final DistrictCatalog catalog;
    private final DistrictFacilityService service;
    public DistrictFacilityController(DistrictCatalog catalog, DistrictFacilityService service) {
        this.catalog = catalog;
        this.service = service;
    }
    @GetMapping("/districts")
    public List<DistrictCatalog.County> districts() { return catalog.counties(); }
    @GetMapping("/facilities")
    public FacilitySearchResponse facilities(@RequestParam String county, @RequestParam(required = false) String districtCode,
            @RequestParam(required = false) String type, @RequestParam(required=false) String department) { return service.search(county, districtCode, type, department); }
    @GetMapping("/facilities/departments")
    public List<String> departments() { return service.departments(); }
    @GetMapping("/facilities/detail")
    public tw.advanceddb.medical.model.FacilityDetail detail(@RequestParam String sourceId) { return service.detail(sourceId); }
}
