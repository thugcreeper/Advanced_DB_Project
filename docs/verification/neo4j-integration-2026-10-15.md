# 本機 Neo4j Schema 整合驗證與稽核

日期：2026-10-15（Asia/Taipei）。來源為 `medicalfacilities`，目標為 `neo4j`，實際 Neo4j 2026.09.0 Enterprise。
只在本機執行，沒有 AuraDB、雲端連線、來源重新匯入或 Git push。

## 結果

院所與科別已完成複製；來源保留，政府統計不覆寫。
完整 23,238 筆院所逐筆屬性與型別差異 0；28,631 條原始科別關係逐條可追溯。
target 的政府統計 1,701 個節點、13,942 條關係，包含 ID、方向、端點及全部屬性，逐筆不變。
來源 23,282 個節點、28,631 條關係及原有約束／索引定義不變。

| 節點／關係 | 目標整合前 | 目標整合後 |
| --- | ---: | ---: |
| 鄉鎮區碼與名稱 | 368 | 368 |
| 綜合所得 | 368 | 368 |
| 人口與土地 | 368 | 368 |
| 醫療院所統計 | 525 | 525 |
| 醫事人員類別 | 27 | 27 |
| 科別 | 45 | 53 |
| 醫療院所 | 0 | 23238 |
| RECORD_INCOME | 368 | 368 |
| RECORD_POPULATION_AND_AREA | 368 | 368 |
| RECORD_MEDICAL_FACILITIES | 525 | 525 |
| RECORD_PERSONNEL | 6309 | 6309 |
| RECORD_DEPARTMENT | 6372 | 6372 |
| PROVIDE_DEPARTMENT | 0 | 0 |
| HAS_DEPARTMENT | 0 | 28631 |
| HAS_FACILITY | 0 | 23238 |

新增三個唯一性約束：院所 sourceId、科別名稱、科別關係來源鍵。
原有 NODE_KEY、personnel 唯一性約束與所有原有索引保留。
索引的 lastRead/readCount 等查詢使用統計自然更新，不當作節點／關係或索引結構變更。

## TC-01～TC-12

以下編號是本次整合規格，與舊統計快照案例分開。

| 案例 | 結果 | 實際證據 |
| --- | --- | --- |
| TC-01 同義名稱 | PASS | 家醫科→家庭醫學科 1633 條，耳鼻喉別名→耳鼻喉科 4 條；合計 1637 條保留原名與來源鍵 |
| TC-02 科別共用 | PASS | 內科節點 1 個，官方與院所關係連到同一節點；全部科別名稱唯一 |
| TC-03 獨有科別 | PASS | 洗腎科及其院所關係保留；中醫針灸科原節點與官方關係保留 |
| TC-04 院所完整性 | PASS | 來源／目標 23238；唯一 ID 23238；全部原屬性與型別差異 0 |
| TC-05 科別關係完整性 | PASS | 來源／目標 28631；來源鍵唯一；原名、屬性與端點逐條一致；例外 0 |
| TC-06 更名狀態 | PASS | 盤點前已為新名稱：舊 0、新 6372；安全略過，沒有再建立關係或增補統計年 |
| TC-07 行政區歸屬 | PASS | matched 23238、unmatched 0、ambiguous 0；每間最多一個行政區；香山區代碼 1205，14 間 |
| TC-08 實際內科查詢 | PASS | 香山區內科 2 間，由實際 HAS_DEPARTMENT 證明，API 沒有重複院所 |
| TC-09 政府統計保護 | PASS | 原節點、關係、院所家數、人力、科別數量、端點、方向與所有原屬性一致 |
| TC-10 九個範例 | PASS | 全部欄位和值與整合前完整基準一致，指定排序不變；完全同值 ties 的列序可不同 |
| TC-11 冪等與恢復 | PASS | 提交兩批 500 間後中斷，重跑完成；再次完整重跑，節點、關係與屬性不變 |
| TC-12 來源保護 | PASS | Source nodes/relations 全部逐筆相同；沒有來源寫入，原 labels、端點、屬性與索引／約束定義保留 |

可執行驗證入口：`backend/migrate-schema.cmd verify migration-local`。
新增 Java 規則測試及 Node/Playwright 對全區院所集合、原始屬性、分類、科別及地圖的驗證。
完整輸出為本機 `backend/migration-local/verification.json`，沒有將口頭確認代替驗證。

## 行政區配對與分類

23,144 間使用完整縣市＋行政區地址前綴；94 間沿用 2026-10-12 已核准且縣市／代碼一致的來源欄位。
原始地址與座標不變，四筆座標衝突旗標保留；不因座標衝突把可靠的院所行政區歸屬改成猜測位置。
沒有 CONTAINS 行政區字串寫入規則。matched/unmatched/ambiguous 的逐筆方法與原因都存到本機報告。

院所查詢保留原範圍：483 間醫院、22742 間診所，合計 23225。
13 筆病理中心完整複製，但不列為醫院或診所；15 種來源類型以明確四類醫院、十類診所及病理中心處理。
全 368 區 API 與來源院所 ID 集合、名稱、地址、類型、電話、經緯度及待複核標記逐筆一致。
官方統計科別選項 45，實際院所科別選項 42，沒有混合兩種統計口徑。

## 科別對照與例外

44 個來源名稱：34 個完全相同、2 個明確別名、8 個獨有名稱。
原名和標準名全表及兩邊關係數見 [完整 Schema](../specs/neo4j-integrated-schema.md)。
八個新增名稱為一般精神科、不分科、兒童青少年精神科、成癮防治科、放射線科、洗腎科、牙科、病理科。
沒有合併成語意不同的官方名稱；保留原 45 個科別節點。
缺失／重複院所 ID 0，重複來源科別關係 0，標準化同院所碰撞 0，異常科別 0。
單元測試另構造兩個原名共用標準名的情境，確認仍保留兩條獨立來源關係鍵。

## 批次與中斷稽核

每批 250 筆。第一次故意在提交 2 批、500 間院所後停止，然後不帶故障參數恢復。
下表是含中斷、恢復及第二次完整重跑的累計；processed 包含既有資料重處理，不等於新增數。

| 階段 | 已提交批次 | 累計 processed | 新增 | 既有重處理 | 失敗筆數 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 院所 | 188 | 46976 | 23238 | 23738 | 0 |
| 標準科別節點 | 2 | 84 | 8 | 76 | 0 |
| 科別關係 | 230 | 57262 | 28631 | 28631 | 0 |
| 行政區關係 | 186 | 46476 | 23238 | 23238 | 0 |
| 統計關係更名 | 2 次狀態檢查 | — | 0 | 略過 | 0 |

完整每批 offset 與 counters 在 `batches.jsonl`；本次較早紀錄的既有數可由 processed−created 得到，
最終程式亦明確記錄 alreadyExisting。沒有為美化結果刪除中斷或失敗紀錄。
`interruption-tested.json` 與 `idempotency.json` 保存中斷、恢復及重跑證據。

## 九個範例與網站

九題的整合前／後筆數依序為：5、76、76、368、368、3、0、26、2。
第六題仍是新店、太平、臺東市三筆，面積 P80 107.5898、院所 P80 94.6。
第七題仍零筆，門檻未改；所有完整欄位與數值均對上原基準。
九題本來沒有直接引用舊科別統計關係，保留查詢字串；條件篩選 Repository、參考測試、現行契約與 Schema 頁面已使用 RECORD_DEPARTMENT。
舊名只留在遷移狀態偵測、更名相容程式、負向測試與歷史驗證文件，不留在正常統計或網站查詢路徑。

實際院所 API 改用 neo4j 的醫療院所及 HAS_FACILITY／HAS_DEPARTMENT，增加 department 參數與科別選項 API。
前端行政區頁新增科別選單，標示目前院所清單與 114 年官方彙總的差別。
桌面 1440×1000、390×844、320×700 測試：搜尋內科 2 間、清除科別回到 14 間、真實標記、來源說明與資料介紹連結正常，無 pageerror 或頁面水平溢出。
圖磚仍依賴外部 OpenStreetMap；驗證標記與座標，不把外部網路可用性當作統計正確性。

## 測試結果與限制

- 最終 Maven package：39 通過、0 失敗、10 舊快照測試未啟用；未把 skip 算作通過。
- 本次整合 verifier：12 PASS。
- 新增院所 API／全區集合／UI：5 通過。
- 既有 Cypher＋統計前端/live/UI/visual：38 通過、1 失敗、2 TODO。
- 仍失敗的是**舊統計 TC-08 西醫師快照預期**，不是本次整合 TC-08：鳥松區醫院西醫師實際 973，原預期 1072；來源與斷言都沒有改。
- 兩個舊 TODO 是隔離 Neo4j fixture，仍保持 TODO。
- 初次驗證器錯取同名所得節點的空代碼，已限定中心行政區 Label 並新增測試，沒有變更實際配對資料。
- 完整恢復流程與本機工具參數已提供，但沒有實際覆寫資料庫做災難恢復演練；不宣稱已實測還原。

## 備份與檔案

兩庫在線完整備份成功且 `--inspect-path` 顯示 FULL=true、RECOVERED=true：

- `medicalfacilities-2026-10-14T16-26-08.backup`
- `neo4j-2026-10-14T16-26-13.backup`

檔名使用 UTC，對應臺北時間 2026-10-15。
SHA-256 manifest 已建立並於每次 migrate 核對；備份沒有角色／使用者 metadata，本次不改權限。
管理流程及還原命令見 [操作文件](../specs/neo4j-integration-operations.md)。
完整 snapshots、關係追溯、配對明細、批次紀錄及備份留在 Git 忽略的 `backend/migration-local`；
截圖留在工作副本 `tests/integration/artifacts`，不提交個別院所資料、私密設定、備份或圖片。

## 主要修改位置

- `backend/src/main/java/tw/advanceddb/medical/migration/`：管理命令、typed 快照、預演、Java 正規化、配對、批次寫入及完整驗證。
- `Neo4jConnection`：網站目標庫與來源庫明確分開，管理命令限定本機。
- `DistrictStatisticsRepository`、統計參考及唯讀測試：RECORD_DEPARTMENT。
- `DistrictFacilityRepository/Service/Controller`、`FacilitySearchResponse`、`FacilityTypeClassifier`：整合圖、確切類型與實際科別查詢。
- 原 JSON 匯入 Repository／入口：明確仍是來源庫，不在本次執行。
- `pages/district/`：實際科別選擇與口徑標示；`pages/data/index.html`：七種統計／實際資料關係。
- `tests/integration/`、`MigrationRulesTest`、`DistrictSearchTest`：完整快照與 API／UI 回歸。
- `.gitignore`、README、現行契約、Schema 及操作文件。

保留先前首頁移除與尚未提交的資料介紹頁；不自動 commit 或 push。

## 正式 Repo 同步驗證

2026-10-15 已同步至 `C:\Users\User\Desktop\git-repos\Advanced_DB_Project`，並重新執行 Maven package：39 通過、0 失敗、10 未啟用。
確認查詢頁、行政區頁與資料介紹的來源檔和 `target/classes/static` 資源雜湊一致。
正式 repo 的獨立測試服務使用 18085，原有 18080 程序未停止；使用者仍須重啟原服務才能載入新版 Java 程式。
本機 Neo4j 啟動後，以原有 `.env` 成功完成唯讀驗證：12 項整合檢查、5 項 API／桌面／手機 UI 測試及九個範例結果比對均通過。
初次連線失敗期間曾出現登入失敗日誌，但未能確認客戶端來源；不能據此判定 `.env` 密碼錯誤。本次未修改帳密、重設權限或重新遷移資料。
備份與稽核副本放在正式 repo 的 Git 忽略目錄 `backend/migration-local`，工作副本原件亦保留。

## 一次性工具清理

整合驗證完成後，依使用者要求移除 `backend/src/main/java/tw/advanceddb/medical/migration/`、`MigrationRulesTest` 與 `backend/migrate-schema.cmd`，以及僅供管理命令使用的 `Neo4jConnection.openLocal`。
上述工具與測試結果為歷史紀錄，不表示清理後仍有這些入口；未重新搬移或刪除任何資料庫內容。
網站仍需要的 `FacilityTypeClassifier` 及其類型分類測試保留，測試移至獨立的 `FacilityTypeClassifierTest`。
備份、稽核紀錄、Schema 與整合報告保留；工具原始碼另封存在工作區的 `migration-tools-archive-20261015-114047.zip`，不加入正式 repo。
清理後重新 package：27 通過、0 失敗、10 舊快照測試未啟用；檢查新版 JAR 無 `migration` 類別。
以新版 JAR 在臨時 18086 服務重跑院所回歸：368 行政區完整集合、22 縣市院所類型總數、實際科別查詢與統計科別隔離共 4 項全數通過，測試後已停止臨時服務。
