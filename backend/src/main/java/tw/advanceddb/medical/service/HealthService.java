package tw.advanceddb.medical.service;

import org.springframework.stereotype.Service;
import tw.advanceddb.medical.model.HealthResponse;

@Service
public class HealthService {
    // HTTP liveness only: deliberately has no database dependency.
    public HealthResponse getHealth() {
        return new HealthResponse("UP", "medical-resource-backend");
    }
}
