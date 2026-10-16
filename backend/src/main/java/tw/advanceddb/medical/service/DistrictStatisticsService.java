package tw.advanceddb.medical.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.StatisticsFilter;
import tw.advanceddb.medical.model.StatisticsFilter.*;
import tw.advanceddb.medical.repository.DistrictStatisticsRepository;

@Service
public class DistrictStatisticsService {
    private final DistrictStatisticsRepository repository;
    private final DistrictCatalog catalog;
    private static final Set<String> FIELDS = Set.of("name","income","population","area","hospitalCount","clinicCount","staff","staffRate","doctors","doctorRate","westernDoctors","chineseDoctors","dentists","westernDoctorRate","personnel","specialty");
    public DistrictStatisticsService(DistrictStatisticsRepository repository, DistrictCatalog catalog) {
        this.repository = repository; this.catalog = catalog;
    }
    public Map<String,Object> search(StatisticsFilter request) {
        if (request == null) throw new IllegalArgumentException("請提供查詢條件。");
        String county = county(request.county());
        if (request.districtCode() != null && !request.districtCode().isBlank()) catalog.require(county, request.districtCode());
        validate(request.income(), false); validate(request.population(), true); validate(request.area(), false);
        validate(request.hospitals(), true); validate(request.clinics(), true);
        var sorts = request.sort() == null ? List.<Sort>of() : request.sort();
        if (sorts.size()>3) throw new IllegalArgumentException("最多三個排序欄位。");
        for (var sort : sorts) if (sort == null || sort.field()==null || sort.direction()==null || !FIELDS.contains(sort.field()) || !Set.of("asc","desc").contains(sort.direction())) throw new IllegalArgumentException("排序欄位或方向無效。");
        var chosen=new ArrayList<Selection>();
        if(request.specialties()!=null) chosen.addAll(request.specialties());
        if(request.specialty()!=null) {
            if(!chosen.isEmpty())throw new IllegalArgumentException("請擇一使用 specialty 或 specialties。");
            chosen.add(request.specialty());
        }
        if(chosen.stream().anyMatch(Objects::isNull))throw new IllegalArgumentException("科別不得為空。");
        if(chosen.size()>45)throw new IllegalArgumentException("最多選擇 45 科。");
        String match=request.specialtyMatch()==null?"or":request.specialtyMatch();
        if(!Set.of("or","and").contains(match))throw new IllegalArgumentException("科別匹配必須為 or 或 and。");
        var categories=(request.personnel()!=null||!chosen.isEmpty())?repository.categories():Map.<String,List<String>>of();
        String personnel=selection(request.personnel(),categories.getOrDefault("personnel",List.of()));
        String scope=request.personnel()!=null?scope(request.personnel()):chosen.isEmpty()?"all":scope(chosen.get(0));
        var selected=new ArrayList<Map<String,Object>>();var names=new HashSet<String>();
        for(var item:chosen) {
            String category=selection(item,categories.getOrDefault("specialties",List.of()));
            if(category.isEmpty()||!names.add(category))throw new IllegalArgumentException("科別不得為空或重複。");
            if(!scope.equals(scope(item)))throw new IllegalArgumentException("人員及各科別請使用相同統計範圍。");
            var value=new LinkedHashMap<String,Object>();value.put("category",category);value.put("position",selected.size());
            value.put("min",item.count()==null?null:item.count().min());value.put("max",item.count()==null?null:item.count().max());selected.add(value);
        }
        var parameters=DistrictStatisticsRepository.parameters();parameters.put("county",county);
        parameters.put("districtCode",request.districtCode()==null?"":request.districtCode());
        parameters.put("personnel",personnel);parameters.put("scope",scope);parameters.put("specialties",selected);parameters.put("specialtyMatch",match);
        putRange(parameters,"income",request.income());putRange(parameters,"population",request.population());putRange(parameters,"area",request.area());
        putRange(parameters,"hospitalCount",request.hospitals());putRange(parameters,"clinicCount",request.clinics());
        putRange(parameters,"personnel",request.personnel()==null?null:request.personnel().count());
        parameters.put("sort",sorts.stream().map(sort->Map.of("field",sort.field(),"direction",sort.direction())).toList());
        var rows=normalize(repository.search(parameters));
        rows.forEach(row->{row.remove("specialtyRows");if(personnel.isEmpty())row.put("personnel",null);if(chosen.isEmpty())row.put("specialty",null);});
        rows.removeIf(row -> !county.isEmpty() && !county.equals(row.get("county"))
                || request.districtCode()!=null && !request.districtCode().isBlank() && !request.districtCode().equals(row.get("code"))
                || !matches(row.get("income"), request.income()) || !matches(row.get("population"), request.population())
                || !matches(row.get("area"), request.area()) || !matches(row.get("hospitalCount"), request.hospitals())
                || !matches(row.get("clinicCount"), request.clinics())
                || !matchesSelection(row.get("personnel"), request.personnel())
                || !matchesSpecialties(row,chosen,match));
        Comparator<Map<String,Object>> comparator = (a,b) -> 0;
        for (var sort : sorts) comparator = comparator.thenComparing((a,b) -> compare(a.get(sort.field()), b.get(sort.field()), sort.direction()));
        rows.sort(comparator);
        var applied=new LinkedHashMap<String,Object>();applied.put("county",county);applied.put("districtCode",parameters.get("districtCode"));applied.put("scope",scope);
        applied.put("specialtySelections",selected);applied.put("specialties",chosen.stream().map(Selection::category).toList());applied.put("specialtyMatch",match);applied.put("personnel",personnel);applied.put("sort",parameters.get("sort"));
        var ranges=new LinkedHashMap<String,Object>();
        for(String key:List.of("income","population","area","hospitalCount","clinicCount","personnel")) {
            var value=new LinkedHashMap<String,Object>();value.put("min",parameters.get(key+"Min"));value.put("max",parameters.get(key+"Max"));ranges.put(key,value);
        }
        applied.put("ranges",ranges);
        return Map.of("total",rows.size(),"districts",rows,"scope",scope,"appliedFilters",applied,"source","政府行政區統計；科別使用 RECORD_DEPARTMENT，不是個別院所名單");
    }
    public Map<String,Object> options(String requestedCounty) {
        String county = county(requestedCounty);
        var rows = normalize(repository.search(DistrictStatisticsRepository.parameters()));
        rows.removeIf(row -> !county.isEmpty() && !county.equals(row.get("county")));
        Map<String,Object> bounds = new LinkedHashMap<>();
        for (String field : List.of("income","population","area","hospitalCount","clinicCount")) {
            var values = rows.stream().map(row -> row.get(field)).filter(Number.class::isInstance).mapToDouble(value -> ((Number)value).doubleValue()).summaryStatistics();
            var range = new LinkedHashMap<String,Object>(); range.put("min", values.getCount()==0 ? null : values.getMin()); range.put("max", values.getCount()==0 ? null : values.getMax()); bounds.put(field, range);
        }
        var categories = repository.categories();
        return Map.of("bounds",bounds,"personnel",categories.get("personnel"),"specialties",categories.get("specialties"),"counties",catalog.counties());
    }
    private String county(String value) { return value==null || value.isBlank() ? "" : catalog.requireCounty(value); }
    private String scope(Selection selection) {
        String value = selection.scope()==null ? "all" : selection.scope();
        if (!Set.of("all","hospital","clinic").contains(value)) throw new IllegalArgumentException("統計範圍無效。");
        return value;
    }
    private String selection(Selection selection, List<String> allowed) {
        if (selection==null) return "";
        scope(selection); validate(selection.count(), true);
        if (selection.category()==null || !allowed.contains(selection.category())) throw new IllegalArgumentException("人員或科別不存在。");
        return selection.category();
    }
    private static void putRange(Map<String,Object> parameters,String key,Range range) {
        parameters.put(key+"Min",range==null?null:range.min());parameters.put(key+"Max",range==null?null:range.max());
    }
    private static boolean matchesSpecialties(Map<String,Object> row,List<Selection> chosen,String match) {
        if(chosen.isEmpty())return true;
        var data=row.get("specialties");
        var values=data instanceof List<?> list?list:List.of();
        var outcomes=chosen.stream().map(selection->{
            Object value=null;
            for(Object item:values)if(item instanceof Map<?,?> map&&selection.category().equals(map.get("category"))){value=map.get("selected");break;}
            return matchesSelection(value,selection);
        }).toList();
        return match.equals("and")?outcomes.stream().allMatch(Boolean::booleanValue):outcomes.stream().anyMatch(Boolean::booleanValue);
    }
    private List<Map<String,Object>> normalize(List<Map<String,Object>> source) {
        var districts = catalog.counties().stream().flatMap(county -> county.districts().stream()).toList();
        List<Map<String,Object>> rows = new ArrayList<>();
        for (var original : source) {
            var district = districts.stream().filter(d -> (d.county()+d.name()).equals(original.get("name"))).findFirst().orElseThrow(() -> new IllegalStateException("統計行政區無法對應。"));
            var row = new LinkedHashMap<>(original); row.put("code", district.code()); row.put("county",district.county()); row.put("name",district.name()); row.put("averageIncome",row.get("income"));
            row.put("staff",sum(row,"hospitalStaff","clinicStaff")); row.put("doctors",sum(row,"hospitalDoctors","clinicDoctors"));
            for (String category : List.of("WesternDoctors","ChineseDoctors","Dentists")) {
                String total=Character.toLowerCase(category.charAt(0))+category.substring(1);
                row.put(total,sum(row,"hospital"+category,"clinic"+category));
            }
            row.put("westernDoctorRate",rate(row.get("westernDoctors"),row.get("population")));
            row.put("staffRate",rate(row.get("staff"),row.get("population"))); row.put("doctorRate",rate(row.get("doctors"),row.get("population")));
            rows.add(row);
        }
        return rows;
    }
    private static double sum(Map<String,Object> row,String a,String b) { return number(row.get(a))+number(row.get(b)); }
    private static double number(Object value) { return value==null ? 0 : ((Number)value).doubleValue(); }
    public static Double rate(Object total,Object population) {
        if (population==null || number(population)<=0) return null;
        return BigDecimal.valueOf(number(total)).multiply(BigDecimal.valueOf(10000)).divide(BigDecimal.valueOf(number(population)),2,RoundingMode.HALF_UP).doubleValue();
    }
    private static void validate(Range range, boolean integral) {
        if (range==null) return;
        for (Double value : new Double[]{range.min(),range.max()}) if (value!=null && (!Double.isFinite(value) || value<0 || integral && value!=Math.rint(value))) throw new IllegalArgumentException("條件必須是非負有效數值；人口及家數需為整數。");
        if (range.min()!=null && range.max()!=null && range.min()>range.max()) throw new IllegalArgumentException("下限不得大於上限。");
    }
    private static boolean matchesSelection(Object value, Selection selection) {
        // Selecting a category means it must be present in the chosen scope.
        // A missing minimum, or an explicit zero, must not include zero-count rows.
        return selection == null || value instanceof Number && number(value) > 0 && matches(value, selection.count());
    }
    private static boolean matches(Object value,Range range) {
        if (range==null || range.min()==null && range.max()==null) return true;
        if (!(value instanceof Number)) return false;
        return (range.min()==null || number(value)>=range.min()) && (range.max()==null || number(value)<=range.max());
    }
    private static int compare(Object a,Object b,String direction) {
        if (a==null) return b==null ? 0 : 1;
        if (b==null) return -1;
        int value = a instanceof Number && b instanceof Number ? Double.compare(number(a),number(b)) : a.toString().compareTo(b.toString());
        return direction.equals("desc") ? -value : value;
    }
}
