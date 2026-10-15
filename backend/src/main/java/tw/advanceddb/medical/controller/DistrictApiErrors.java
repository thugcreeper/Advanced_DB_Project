package tw.advanceddb.medical.controller;
import java.util.Map;
import org.neo4j.driver.exceptions.Neo4jException;
import org.springframework.http.*;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice(assignableTypes = DistrictFacilityController.class)
public class DistrictApiErrors {
    @ExceptionHandler(tw.advanceddb.medical.service.DistrictFacilityService.FacilityNotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(Exception exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("code", "FACILITY_NOT_FOUND", "message", "查無此院所，請重新搜尋。"));
    }
    @ExceptionHandler({IllegalArgumentException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_FILTER", "message", "查詢條件或院所識別碼無效，請確認後重試。"));
    }
    @ExceptionHandler({Neo4jException.class, IllegalStateException.class, io.github.cdimascio.dotenv.DotenvException.class})
    public ResponseEntity<Map<String, String>> unavailable(Exception exception) {
        DatabaseDiagnostics.log(exception);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("code", "DATABASE_UNAVAILABLE", "message", "資料服務異常，請稍後再試。"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> failed(Exception exception) {
        DatabaseDiagnostics.log(exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("code", "QUERY_FAILED", "message", "院所查詢失敗，請稍後重試。"));
    }
}
