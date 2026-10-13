package tw.advanceddb.medical.controller;

import org.springframework.web.bind.annotation.*;
import tw.advanceddb.medical.service.CypherQueryService;

@RestController
@RequestMapping("/api/cypher")
public class CypherController {
    private final CypherQueryService service;
    public CypherController(CypherQueryService service) { this.service = service; }
    @PostMapping("/query")
    public CypherQueryService.Response query(@RequestBody CypherQueryService.Request request) { return service.execute(request); }
}
