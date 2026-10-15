# 統計功能測試

保留受控 repository 的 Java 合約、數值計算、表格排序、CSV、安全及目前網站互動測試。
舊資料庫固定快照、過時 TC08 預期與未實作 fixture TODO 已移除；未改動資料庫或把舊預期改成目前值。

```powershell
# backend 目錄，Java 17
./mvnw.cmd -Dmaven.repo.local=.maven-cache/repository -o test
# repo 根目錄，Node / Playwright
node --test tests/statistics/frontend.test.cjs
node --test tests/statistics/live.test.cjs tests/statistics/query-ui.test.cjs
```

live 測試以 STATISTICS_BASE 指定後端，預設 http://127.0.0.1:18080；需使用對應版本的前端與 API。
Aura 連線驗證另以 AURA_READ_TESTS=true 啟用 Java AuraReadOnlyTest，未啟用不算通過。
資料庫由 NEO4J_DATABASE 明確指定，不假定名稱為 neo4j。憑證不提交，測試不寫入正式資料庫。
