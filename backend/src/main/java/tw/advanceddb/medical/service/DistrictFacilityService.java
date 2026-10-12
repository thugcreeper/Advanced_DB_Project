package tw.advanceddb.medical.service;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.FacilitySearchResponse;
import tw.advanceddb.medical.repository.DistrictFacilityRepository;

@Service
public final class DistrictFacilityService {
    private final DistrictCatalog catalog;
    private final DistrictFacilityRepository repository;
    public DistrictFacilityService(DistrictCatalog catalog, DistrictFacilityRepository repository) {
        this.catalog = catalog;
        this.repository = repository;
    }
    public FacilitySearchResponse search(String county, String districtCode, String type) {
        String countyName = catalog.requireCounty(county);
        String code = districtCode == null ? "" : districtCode.trim();
        String districtName = code.isEmpty() ? "" : catalog.require(countyName, code).name();
        String selectedType = type == null || type.isBlank() ? (code.isEmpty() ? "hospital" : "all") : type.trim();
        if (!Set.of("all", "hospital", "clinic").contains(selectedType)) throw new IllegalArgumentException("院所類型必須為 all、hospital 或 clinic。");
        String pattern = "^(?:[0-9０-９]{3,6})?" + Pattern.quote(countyName + districtName) + ".*";
        var result = repository.search(countyName, code, selectedType, pattern,
                catalog.addressPattern(), catalog.districtKeys(), catalog.addressPrefixes());
        long unlocated = result.facilities().stream().filter(facility -> !facility.hasLocation()).count();
        return new FacilitySearchResponse(countyName, code, districtName, selectedType,
                result.total(), unlocated, result.unassignedTotal(), result.facilities());
    }
}
