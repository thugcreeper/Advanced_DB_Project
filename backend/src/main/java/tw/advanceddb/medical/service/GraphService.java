package tw.advanceddb.medical.service;
import java.util.*;
import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.GraphResponse;
import tw.advanceddb.medical.repository.GraphRepository;
@Service
public final class GraphService {
    private final DistrictCatalog catalog;
    private final GraphRepository repository;
    public GraphService(DistrictCatalog catalog, GraphRepository repository) { this.catalog=catalog; this.repository=repository; }
    public GraphResponse read(String county, String code, String type, String department, int offset, int limit) {
        String countyName=catalog.requireCounty(county);
        var district=catalog.require(countyName, code == null ? "" : code.strip());
        if (!Set.of("all","hospital","clinic").contains(type) || offset<0 || offset>100000 || limit<1 || limit>24)
            throw new IllegalArgumentException("圖形查詢條件無效；每批最多 24 間院所。");
        String selected=department == null ? "" : department.strip();
        if (selected.length()>80 || selected.chars().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("科別條件無效。");
        var types = switch(type) {
            case "hospital" -> FacilityTypeClassifier.HOSPITALS;
            case "clinic" -> FacilityTypeClassifier.CLINICS;
            default -> java.util.stream.Stream.concat(FacilityTypeClassifier.HOSPITALS.stream(), FacilityTypeClassifier.CLINICS.stream()).toList();
        };
        var page=repository.read(district.code(), types, selected, offset, limit);
        return new GraphResponse(countyName,district.code(),district.name(),type,selected,offset,limit,page.total(),page.facilities());
    }
}
