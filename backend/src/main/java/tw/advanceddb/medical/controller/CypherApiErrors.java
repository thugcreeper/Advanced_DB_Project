package tw.advanceddb.medical.controller;

import java.util.Map;
import org.neo4j.driver.exceptions.Neo4jException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import tw.advanceddb.medical.service.CypherQueryService.Rejected;

@RestControllerAdvice(assignableTypes=CypherController.class)
public class CypherApiErrors {
    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String,String>> invalid(Exception error) {
        return reply(400, "INVALID_QUERY", error instanceof HttpMessageNotReadableException ? "請提供有效的查詢 JSON。" : error.getMessage());
    }
    @ExceptionHandler(Rejected.class)
    public ResponseEntity<Map<String,String>> rejected(Rejected error) { return reply(403, "READ_ONLY", error.getMessage()); }
    @ExceptionHandler(Neo4jException.class)
    public ResponseEntity<Map<String,String>> database(Neo4jException error) {
        String code = error.code();
        if (code.contains("Unauthorized") || code.contains("Authentication") || code.contains("CredentialsExpired"))
            return reply(503, "DATABASE_UNAVAILABLE", "資料服務異常，請稍後再試。");
        if (code.contains("TimedOut") || code.contains("Timeout")) return reply(408, "QUERY_TIMEOUT", "查詢超過 15 秒，請縮小查詢範圍後重試。");
        if (code.contains("Security") || code.contains("AccessMode")) return reply(403, "QUERY_FORBIDDEN", "沒有執行此唯讀查詢的權限。");
        if (code.contains("Statement")) return reply(400, "QUERY_SYNTAX", "Cypher 語法、欄位型別或參數有誤，請檢查查詢內容。");
        return reply(503, "DATABASE_UNAVAILABLE", "查詢服務暫時無法使用，請稍後重試。");
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,String>> failed(Exception error) { return reply(503, "QUERY_FAILED", "查詢服務暫時無法使用，請稍後重試。"); }
    private ResponseEntity<Map<String,String>> reply(int status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("code", code, "message", message));
    }
}
