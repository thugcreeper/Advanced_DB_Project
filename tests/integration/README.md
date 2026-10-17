# 網站整合測試

目前保留 API 來源、連線等待／恢復、圖形、院所詳情、CARE、地圖與桌面／手機互動驗證。
已移除一次性搬移的前後快照工具、全量歷史快照比對及依賴 backend/migration-local 的案例；備份原件保留。

一般 live 測試使用 INTEGRATION_BASE，預設 http://127.0.0.1:18080。執行前確認服務為目前版本。

```powershell
node --test tests/integration/api-origin.test.cjs tests/integration/connection-state.test.cjs
node --test tests/integration/graph.test.cjs
```

圖形測試使用暫存靜態服務與受控資料。設定 GRAPH_BASE 指向新版後端，可額外執行真實 Aura 與跨頁唯讀測試；未啟用的案例以 skip 記錄，不計通過。
Playwright 需可用；可用 PLAYWRIGHT_EXECUTABLE 指定本機 Chromium。
截圖及測試輸出僅存本機 artifacts，不提交。測試不執行資料遷移或寫入正式資料庫。


## 行政區院所 Modal 與 CARE 七日表（2026-10-17）

```powershell
node --test tests/integration/care-detail.test.cjs tests/integration/facility-property-contract.test.cjs tests/integration/graph.test.cjs
```

CARE 測試現在使用實際頁面與受控 API，涵蓋 Modal、焦點、關閉、動態時段、臺灣跨日、科別整列配色與五種寬度。
設定 `FACILITY_LIVE_CHECK=true` 可額外用本機前端搭配正式唯讀 API 驗證實際院所；測試不部署、不修改資料庫。
以 `PLAYWRIGHT_EXECUTABLE` 指定可用 Chromium；測試圖存於忽略的 `artifacts/care-modal-*.png`。
`facility-detail.test.cjs` 與 `district-interactions.test.cjs` 仍需提供新版本機服務的 `INTEGRATION_BASE`，這次已同步其 Modal 驗收條件。
