package tw.advanceddb.medical.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.*;
import tw.advanceddb.medical.model.StatisticsFilter;
import tw.advanceddb.medical.service.DistrictStatisticsService;

@RestController
@RequestMapping("/api/districts/statistics")
public class DistrictStatisticsController {
    private final DistrictStatisticsService service;
    public DistrictStatisticsController(DistrictStatisticsService service) { this.service=service; }
    @PostMapping("/search") public Map<String,Object> search(@RequestBody StatisticsFilter request) { return service.search(request); }
    @GetMapping("/options") public Map<String,Object> options(@RequestParam(required=false) String county) { return service.options(county); }
}
