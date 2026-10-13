package tw.advanceddb.medical.controller;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.neo4j.driver.exceptions.Neo4jException;

@RestControllerAdvice(assignableTypes=DistrictStatisticsController.class)
public class StatisticsApiErrors {
    @ExceptionHandler({IllegalArgumentException.class,HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String,String>> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(Map.of("code","INVALID_FILTER","message", exception instanceof HttpMessageNotReadableException ? "請提供有效的 JSON 與數值條件。" : exception.getMessage()));
    }
    @ExceptionHandler({Neo4jException.class,IllegalStateException.class,io.github.cdimascio.dotenv.DotenvException.class})
    public ResponseEntity<Map<String,String>> unavailable(Exception exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("code","DATABASE_UNAVAILABLE","message","統計資料庫無法連線或查詢逾時，請稍後重試。"));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,String>> failed(Exception exception) {
        return ResponseEntity.internalServerError().body(Map.of("code","QUERY_FAILED","message","統計查詢失敗，請稍後重試。"));
    }
}
