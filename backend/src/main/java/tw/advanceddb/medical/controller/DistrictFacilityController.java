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
            @RequestParam(required = false) String type) { return service.search(county, districtCode, type); }
}
