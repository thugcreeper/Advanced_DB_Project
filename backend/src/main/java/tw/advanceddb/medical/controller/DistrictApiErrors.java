package tw.advanceddb.medical.controller;
import java.util.Map;
import org.neo4j.driver.exceptions.Neo4jException;
import org.springframework.http.*;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice(assignableTypes = DistrictFacilityController.class)
public class DistrictApiErrors {
    @ExceptionHandler({IllegalArgumentException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, String>> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(Map.of("code", "INVALID_FILTER", "message", "請選擇有效的縣市、行政區及院所類型。"));
    }
    @ExceptionHandler({Neo4jException.class, IllegalStateException.class, io.github.cdimascio.dotenv.DotenvException.class})
    public ResponseEntity<Map<String, String>> unavailable(Exception exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("code", "DATABASE_UNAVAILABLE", "message", "Neo4j 無法連線或設定有誤，請確認資料庫已啟動。"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> failed(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("code", "QUERY_FAILED", "message", "院所查詢失敗，請稍後重試。"));
    }
}
