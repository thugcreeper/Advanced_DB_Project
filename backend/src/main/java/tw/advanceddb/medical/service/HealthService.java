package tw.advanceddb.medical.service;

import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.HealthResponse;

@Service
public class HealthService {
    public HealthResponse getHealth() {
        return new HealthResponse("UP", "medical-resource-backend", false);
    }
}
