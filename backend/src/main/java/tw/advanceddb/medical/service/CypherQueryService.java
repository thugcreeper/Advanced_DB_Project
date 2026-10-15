package tw.advanceddb.medical.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.neo4j.driver.*;
import org.neo4j.driver.summary.Plan;
import org.neo4j.driver.summary.QueryType;
import org.neo4j.driver.types.*;
import org.springframework.stereotype.Service;
import tw.advanceddb.medical.config.Neo4jConnection;

@Service
public class CypherQueryService {
    public static final int MAX_ROWS = 1000, MAX_BYTES = 2_000_000, MAX_QUERY = 30_000;
    private static final Set<String> PROCEDURES = Set.of("db.labels", "db.relationshipTypes", "db.propertyKeys", "db.schema.visualization");
    private final Neo4jConnection connection;
    private final ObjectMapper json;
    public record Request(String query, Map<String,Object> parameters) {}
    public record Response(List<String> columns, List<List<Object>> rows, int rowCount,
            boolean truncated, int rowLimit, int timeoutSeconds) {}
    public static class Rejected extends RuntimeException {
        public Rejected(String message) { super(message); }
    }
    public CypherQueryService(Neo4jConnection connection, ObjectMapper json) {
        this.connection = connection; this.json = json;
    }
    public Response execute(Request request) {
        if (request == null || request.query() == null || request.query().isBlank())
            throw new IllegalArgumentException("請輸入 Cypher 查詢。");
        if (request.query().length() > MAX_QUERY) throw new IllegalArgumentException("查詢內容超過 30000 字元。");
        Map<String,Object> parameters = request.parameters() == null ? Map.of() : request.parameters();
        if (bytes(parameters) > 64_000) throw new IllegalArgumentException("查詢參數過大。");
        String query = request.query().trim();
        try (var session = connection.driver().session(SessionConfig.builder().withDatabase(connection.database())
                .withDefaultAccessMode(AccessMode.READ).withFetchSize(100).build());
             var tx = session.beginTransaction(TransactionConfig.builder().withTimeout(Duration.ofSeconds(15)).build())) {
            var summary = tx.run("EXPLAIN " + query, parameters).consume();
            if (summary.queryType() != QueryType.READ_ONLY)
                throw new Rejected("僅允許唯讀查詢，無法執行寫入或管理操作。");
            inspect(summary.plan());
            // User-defined functions can open independent transactions or access external services.
            var functions = tx.run("SHOW FUNCTIONS YIELD name, isBuiltIn WHERE NOT isBuiltIn RETURN name").list(r -> r.get("name").asString());
            String normalized = executableText(query);
            for (String function : functions) if (normalized.contains(function.toLowerCase(Locale.ROOT) + "("))
                throw new Rejected("此查詢包含未開放的自訂函式。");
            var result = tx.run(query, parameters);
            List<String> columns = result.keys();
            if (columns.size() > 100) throw new Rejected("查詢欄位超過 100 欄。");
            List<List<Object>> rows = new ArrayList<>();
            int size = bytes(columns) + 4096; boolean truncated = false;
            while (result.hasNext()) {
                if (rows.size() >= MAX_ROWS) { truncated = true; break; }
                var record = result.next(); List<Object> row = new ArrayList<>();
                int[] budget = { MAX_BYTES };
                for (Value value : record.values()) row.add(convert(value.asObject(), 0, budget));
                int rowBytes = bytes(row);
                if (size + rowBytes > MAX_BYTES) { truncated = true; break; }
                rows.add(row); size += rowBytes;
            }
            // Always roll back, including capped results; never commit user-provided queries.
            tx.rollback();
            return new Response(columns, rows, rows.size(), truncated, MAX_ROWS, 15);
        }
    }
    static void inspect(Plan plan) {
        if (plan.operatorType().contains("Administration") || plan.operatorType().contains("ShowTransactions") || plan.operatorType().contains("TerminateTransactions"))
            throw new Rejected("不開放資料庫管理與交易管理操作。");
        if (plan.operatorType().contains("LoadCSV")) throw new Rejected("不開放外部資料載入。");
        if (plan.operatorType().contains("ProcedureCall")) {
            String signature = plan.arguments().getOrDefault("Details", Values.value("")).asString();
            if (PROCEDURES.stream().noneMatch(name -> signature.startsWith(name + "(")))
                throw new Rejected("此程序未開放；可使用唯讀子查詢與 WITH。");
        }
        plan.children().forEach(CypherQueryService::inspect);
    }
    static String executableText(String query) {
        var text = new StringBuilder();
        for (int i = 0; i < query.length(); i++) {
            char character = query.charAt(i);
            if (character == '\'' || character == '"') {
                char quote = character;
                while (++i < query.length()) {
                    if (query.charAt(i) == '\\') i++;
                    else if (query.charAt(i) == quote) break;
                }
            } else if (character == '`') {
                while (++i < query.length()) {
                    if (query.charAt(i) == '`') {
                        if (i + 1 < query.length() && query.charAt(i + 1) == '`') { text.append('`'); i++; }
                        else break;
                    } else text.append(query.charAt(i));
                }
            } else if (character == '/' && i + 1 < query.length() && query.charAt(i + 1) == '/') {
                while (++i < query.length() && query.charAt(i) != '\n') { }
            } else if (character == '/' && i + 1 < query.length() && query.charAt(i + 1) == '*') {
                i += 2;
                while (i + 1 < query.length() && !(query.charAt(i) == '*' && query.charAt(i + 1) == '/')) i++;
                i++;
            } else if (!Character.isWhitespace(character)) text.append(character);
        }
        return text.toString().toLowerCase(Locale.ROOT);
    }
    private Object convert(Object value, int depth, int[] budget) {
        if (depth > 20) throw new Rejected("查詢結果巢狀層級過深。");
        budget[0] -= value instanceof String text ? bytes(text) : 16;
        if (budget[0] < 0) throw new Rejected("單筆查詢結果超過輸出大小上限。");
        if (value == null || value instanceof String || value instanceof Boolean || value instanceof Number) return value;
        if (value instanceof Node node) {
            var map = new LinkedHashMap<String,Object>(); map.put("elementId", node.elementId());
            map.put("labels", convert(node.labels(), depth + 1, budget)); map.put("properties", convert(node.asMap(), depth + 1, budget)); return map;
        }
        if (value instanceof Relationship relation) return Map.of("elementId", relation.elementId(), "type", relation.type(),
                "start", relation.startNodeElementId(), "end", relation.endNodeElementId(), "properties", convert(relation.asMap(), depth + 1, budget));
        if (value instanceof Path path) {
            var parts = new ArrayList<>(); for (Path.Segment segment : path) parts.add(Map.of(
                    "start", convert(segment.start(), depth + 1, budget), "relationship", convert(segment.relationship(), depth + 1, budget), "end", convert(segment.end(), depth + 1, budget)));
            return parts;
        }
        if (value instanceof Map<?,?> map) {
            var converted = new LinkedHashMap<String,Object>(); map.forEach((key,item) -> {
                String name = String.valueOf(key); budget[0] -= bytes(name);
                converted.put(name, convert(item, depth + 1, budget));
            }); return converted;
        }
        if (value instanceof Iterable<?> items) {
            var converted = new ArrayList<>(); items.forEach(item -> converted.add(convert(item, depth + 1, budget))); return converted;
        }
        return value.toString();
    }
    private int bytes(Object value) {
        try { return json.writeValueAsString(value).getBytes(StandardCharsets.UTF_8).length; }
        catch (JsonProcessingException error) { throw new Rejected("查詢資料無法轉換為 JSON。"); }
    }
}
