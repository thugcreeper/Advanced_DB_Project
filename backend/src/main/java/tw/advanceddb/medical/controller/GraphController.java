package tw.advanceddb.medical.controller;
import org.springframework.web.bind.annotation.*;
import tw.advanceddb.medical.model.GraphResponse;
import tw.advanceddb.medical.service.GraphService;
@RestController
@RequestMapping("/api/graph")
public class GraphController {
    private final GraphService service;
    public GraphController(GraphService service) { this.service=service; }
    @GetMapping("/facilities")
    public GraphResponse facilities(@RequestParam String county, @RequestParam String districtCode,
            @RequestParam(defaultValue="all") String type, @RequestParam(defaultValue="") String department,
            @RequestParam(defaultValue="0") int offset, @RequestParam(defaultValue="12") int limit) {
        return service.read(county,districtCode,type,department,offset,limit);
    }
}
