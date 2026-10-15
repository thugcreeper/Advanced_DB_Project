package tw.advanceddb.medical.controller;

import org.neo4j.driver.exceptions.Neo4jException;
import org.slf4j.LoggerFactory;

/** Controlled server-side diagnostics: never log exception messages or stack traces. */
final class DatabaseDiagnostics {
    private DatabaseDiagnostics() {}

    static void log(Exception error) {
        LoggerFactory.getLogger(DatabaseDiagnostics.class).warn("Data service failure: {}", describe(error));
    }

    static String describe(Throwable error) {
        StringBuilder summary = new StringBuilder();
        // A bounded traversal also tolerates unusual cyclic cause chains.
        for (int depth = 0; error != null && depth < 8; depth++, error = error.getCause()) {
            if (depth > 0) summary.append(" <- ");
            summary.append(error.getClass().getSimpleName());
            if (error instanceof Neo4jException neo) {
                String code = neo.code();
                if (code != null && code.matches("Neo\\.[A-Za-z0-9_.]{1,120}"))
                    summary.append("[").append(code).append("]");
            }
            if (error instanceof IllegalStateException) {
                // Match only known application-generated configuration messages.
                String message = error.getMessage();
                for (String key : new String[]{"NEO4J_DATABASE", "NEO4J_USERNAME", "NEO4J_URI", "NEO4J_PASSWORD"}) {
                    if (("缺少環境設定 " + key + "。").equals(message))
                        summary.append("[missing=").append(key).append("]");
                }
                if ("NEO4J_URI / AURA_CONNECTION_URI 必須使用 neo4j+s:// 加密連線。".equals(message))
                    summary.append("[invalid=URI_SCHEME]");
            }
        }
        return summary.toString();
    }
}
