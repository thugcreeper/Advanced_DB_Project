package tw.advanceddb.medical.service;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.District;

@Service
public final class DistrictCatalog {
    public record County(String name, List<District> districts) {}
    private final Map<String, District> districts = new LinkedHashMap<>();
    private final List<County> counties;
    private final String addressPattern;
    public DistrictCatalog() { this(DistrictCatalog.class.getResourceAsStream("/districts/行政區與代碼.csv")); }
    public DistrictCatalog(InputStream source) {
        if (source == null) throw new IllegalStateException("找不到行政區 CSV。");
        Map<String, List<District>> groups = new LinkedHashMap<>();
        // The inspected CSV has two unquoted columns: numeric code and full district name.
        try (var reader = new BufferedReader(new InputStreamReader(source, StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null || !header.replace("\uFEFF", "").equals("鄉鎮市區碼,鄉鎮市區名稱"))
                throw new IllegalStateException("行政區 CSV 欄位不符。");
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] columns = line.split(",", -1);
                if (columns.length != 2 || !columns[0].matches("[0-9]+") || !columns[1].matches(".{2}[縣市].+"))
                    throw new IllegalStateException("行政區 CSV 格式不符。");
                String fullName = columns[1];
                District district = new District(columns[0], fullName.substring(0, 3), fullName.substring(3));
                if (districts.putIfAbsent(district.code(), district) != null)
                    throw new IllegalStateException("行政區 CSV 代碼重複。");
                groups.computeIfAbsent(district.county(), ignored -> new ArrayList<>()).add(district);
            }
        } catch (IOException exception) { throw new IllegalStateException("行政區 CSV 無法讀取。", exception); }
        if (districts.isEmpty()) throw new IllegalStateException("行政區 CSV 沒有資料。");
        counties = groups.entrySet().stream().map(entry -> new County(entry.getKey(), List.copyOf(entry.getValue()))).toList();
        addressPattern = "^(?:[0-9０-９]{3,6})?(?:" + String.join("|", districts.values().stream()
                .map(district -> Pattern.quote(district.county() + district.name())).distinct().toList()) + ").*";
    }
    public List<County> counties() { return counties; }
    public String addressPattern() { return addressPattern; }
    public List<String> districtKeys() {
        return districts.values().stream().map(district -> district.county() + "|" + district.code()).toList();
    }
    public List<String> addressPrefixes() {
        return districts.values().stream().map(district -> district.county() + district.name()).distinct().toList();
    }
    public String requireCounty(String county) {
        String name = county == null ? "" : county.trim().replace('台', '臺');
        if (counties.stream().noneMatch(item -> item.name().equals(name)))
            throw new IllegalArgumentException("請選擇有效縣市。");
        return name;
    }
    public District require(String county, String code) {
        District district = districts.get(code);
        if (district == null || county == null || !district.county().equals(county.trim().replace('台', '臺')))
            throw new IllegalArgumentException("請選擇相同縣市所屬的行政區。");
        return district;
    }
}
