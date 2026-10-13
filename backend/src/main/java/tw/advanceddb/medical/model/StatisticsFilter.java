package tw.advanceddb.medical.model;

import java.util.List;

public record StatisticsFilter(String county, String districtCode, Range income, Range population, Range area,
        Range hospitals, Range clinics, Selection personnel, Selection specialty, List<Sort> sort) {
    public record Range(Double min, Double max) {}
    public record Selection(String category, String scope, Range count) {}
    public record Sort(String field, String direction) {}
}
