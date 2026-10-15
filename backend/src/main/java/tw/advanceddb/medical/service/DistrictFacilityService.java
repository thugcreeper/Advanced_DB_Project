package tw.advanceddb.medical.service;
import java.util.Set;
import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.FacilitySearchResponse;
import tw.advanceddb.medical.repository.DistrictFacilityRepository;

@Service
public final class DistrictFacilityService {
    public static final class FacilityNotFoundException extends RuntimeException {}
    private final DistrictCatalog catalog;
    private final DistrictFacilityRepository repository;
    private final ClinicHoursParser hours;
    public DistrictFacilityService(DistrictCatalog catalog, DistrictFacilityRepository repository, ClinicHoursParser hours) {
        this.catalog = catalog;
        this.repository = repository;
        this.hours = hours;
    }
    public tw.advanceddb.medical.model.FacilityDetail detail(String sourceId) {
        if (sourceId == null || sourceId.isBlank() || sourceId.length() > 200 || sourceId.chars().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("Invalid facility identifier");
        var row = repository.detail(sourceId).orElseThrow(FacilityNotFoundException::new);
        return new tw.advanceddb.medical.model.FacilityDetail(row.sourceId(), row.name(), row.type(), row.address(), row.phone(),
                row.latitude(), row.longitude(), row.locationReviewRequired(), row.departments(), hours.parse(row.clinicTimeJson()), row.notes(), row.source());
    }
    public java.util.List<String> departments() { return repository.departments(); }
    public FacilitySearchResponse search(String county, String districtCode, String type, String department) {
        String countyName = catalog.requireCounty(county);
        String code = districtCode == null ? "" : districtCode.trim();
        String districtName = code.isEmpty() ? "" : catalog.require(countyName, code).name();
        String selectedType = type == null || type.isBlank() ? (code.isEmpty() ? "hospital" : "all") : type.trim();
        if (!Set.of("all", "hospital", "clinic").contains(selectedType)) throw new IllegalArgumentException("院所類型必須為 all、hospital 或 clinic。");
        String selectedDepartment=department==null?"":department.strip();
        if(!selectedDepartment.isEmpty()&&!repository.departments().contains(selectedDepartment))throw new IllegalArgumentException("請選擇有效的院所科別。");
        var countyCodes=catalog.counties().stream().filter(item->item.name().equals(countyName)).flatMap(item->item.districts().stream()).map(item->item.code()).toList();
        var result = repository.search(countyCodes, code, selectedType, selectedDepartment);
        long unlocated = result.facilities().stream().filter(facility -> !facility.hasLocation()).count();
        return new FacilitySearchResponse(countyName, code, districtName, selectedType,
                result.total(), unlocated, result.unassignedTotal(), result.facilities(), selectedDepartment);
    }
}
