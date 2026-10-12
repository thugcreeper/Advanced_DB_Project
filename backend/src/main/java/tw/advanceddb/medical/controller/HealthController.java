package tw.advanceddb.medical.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.advanceddb.medical.model.HealthResponse;
import tw.advanceddb.medical.service.HealthService;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping
    public HealthResponse getHealth() {
        return healthService.getHealth();
    }
}
