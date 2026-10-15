# 本機 Neo4j 整合管理命令

> 後續已移除來源 JSON 匯入工具與專用 VS Code 執行入口。以下命令及舊設定僅保留為歷史紀錄；目前網站所有查詢共用必填的 `NEO4J_DATABASE`，正式值為 `neo4j`，不再忽略舊設定值或提供 8010 特例。現行啟動與設定見 [後端 README](../../backend/README.md)。

> 2026-10-15 整合已完成，一次性 `migration` 套件與 `migrate-schema.cmd` 已移除。
> 下列 dry-run／migrate／verify 命令為歷史紀錄，目前 checkout 無法直接執行；重新搬移前須取回封存工具並重新評估資料狀態。
> 備份、稽核快照及 Neo4j 原生還原說明保留；不要為了使用網站重跑搬移或還原。

## 範圍與切換

來源 `medicalfacilities` 只讀取；目標寫入 `neo4j`。
管理入口與 Spring Boot 分離，不在啟動網站時執行遷移。
管理命令只允許 loopback URI；沿用本機 `.env`，不新增雲端設定。
既有 `.env` 的 `NEO4J_DATABASE=medicalfacilities` 仍可讀取連線設定，
應用程式各 Session 現在明確選 `neo4j`；舊 JSON 匯入命令仍明確指向來源庫，不在本次流程執行。

以下命令在正式 repo 的 `backend` 執行，Java 為 JDK 17：

```powershell
.\mvnw.cmd '-Dmaven.repo.local=.maven-cache/repository' -o package
.\migrate-schema.cmd dry-run migration-local
```

第一次 dry-run 保存 `source-before.json`、`target-before.json`；之後不覆蓋原始基準。
另產生 inventory、dry-run、44 項科別對照。所有完整資料與備份在 Git 忽略的 `migration-local`。
若要對新的來源版本建立不同基準，使用新的管理資料夾；不可刪除舊報告假裝第一次執行。

## Phase 0：備份

本機實際版本為 Neo4j 2026.09.0 Enterprise，支援線上 `database backup`。
Neo4j 工具需使用 Desktop 隨附的 Java 21，與網站 Java 17 分開：

```powershell
$neoTaskHome='C:\Users\User\.Neo4jDesktop2\Data\dbmss\dbms-fe05b161-892c-40ee-9b90-ff8fde6dc7f6'
$env:JAVA_HOME='C:\Users\User\.Neo4jDesktop2\Cache\runtime\zulu21.50.19-ca-jre21.0.11-win_x64'
$backupTaskPath=Join-Path (Get-Location) 'migration-local/physical-backup'
New-Item -ItemType Directory -Path $backupTaskPath -Force
& "$neoTaskHome\bin\neo4j-admin.bat" database backup --from=localhost:6362 "--to-path=$backupTaskPath" --type=FULL --include-metadata=none --pagecache=256M neo4j medicalfacilities
& "$neoTaskHome\bin\neo4j-admin.bat" database backup "--inspect-path=$backupTaskPath"
```

確認兩個 artifact 均為 `FULL=true`、`RECOVERED=true`，再把 JAVA_HOME 換回 JDK 17並重新 dry-run。
dry-run 產生 SHA-256 manifest；migrate 會核對兩個 artifact 存在、大小與 hash。
備份不含角色／使用者 metadata，因本次不改權限；資料快照還保存現有約束與索引定義。
JSON 快照供逐筆核對，不冒充可取代實體備份的 Neo4j dump。

參考：[線上備份](https://neo4j.com/docs/operations-manual/current/backup-restore/online-backup/)、
[還原備份](https://neo4j.com/docs/operations-manual/current/backup-restore/restore-backup/)。

## Phase 1～4：遷移

先檢視 dry-run 的 errors、例外與行政區匹配，再明確執行：

```powershell
.\migrate-schema.cmd migrate migration-local --confirm-local-write
```

可指定 `--phase=rename`、`facilities`、`departments`、`links` 或 `all`。
只允許已管理的院所更新；新 sourceId 若撞到外部資料會停止，不會覆寫。
來源已變動或政府統計與基準不符時會停止；請停止其他寫入者再執行。

關係更名規則：舊關係為零則略過；只有舊關係則以完整屬性、方向與端點在單一交易更名；
新舊共存會停止並要求逐筆分析，不能用第二次 CREATE 混過部分遷移。
本次現況已更名，舊關係為 0、新關係 6372，因此實際執行應略過。

院所與科別關係每批 250 筆、目標交易 120 秒。
每條來源關係以來源資料庫、sourceId、來源 relationship elementId 計算 SHA-256 追溯鍵。
來源庫不可重建／重匯入後沿用舊基準；elementId 改變時會由來源完整比較擋下。
不同原名即使指向同一標準科別也保留獨立關係及原始屬性。
無效科別記錄到 exceptions；ID 缺失、重複或保留屬性衝突則阻擋寫入。

行政區規則：沿用 2026-10-12 已核准且縣市／代碼一致的 94 筆修正；其餘使用完整縣市行政區地址前綴，
僅正規化台／臺、空白與開頭郵遞區號。模糊字串、縮寫或同名區不猜測。
matched／unmatched／ambiguous 與方法、失敗原因分別記錄；院所節點不因未匹配而丟棄。
四筆座標衝突旗標與原始座標照抄，網站仍暫不畫點。

## 中斷與重跑

`batches.jsonl` 記錄每批 offset、processed、nodesCreated、relationshipsCreated、failed。
已提交批次有 ownership 和唯一鍵，命令重跑不重複新增，失敗批次由交易 rollback。
首次移轉來源版本是完整快照；本次沒有啟用持續同步，也不刪除來源快照未出現的目標院所。
同一基準重跑會讓受管理院所屬性回到來源快照；手工修改受管理資料前須決定新的同步政策。

測試專用 `-Dmigration.failAfterBatches=2` 可在提交兩批後故意中斷；此參數不可設在一般網站 JAVA_OPTS。
恢復時不帶測試參數，重跑 migrate。成功後再重跑一次，檢查 idempotency 報告。

## Phase 5：驗證與網站

```powershell
.\migrate-schema.cmd verify migration-local
```

verify 不寫資料庫，保存來源與目標的遷移後快照及 TC-01～TC-12 結果。
TC-10 需先用 `tests/integration/example-snapshot.cjs --before` 保存九題基準，
遷移後用新網站服務執行不帶 `--before` 的同一程式，核對完整值、欄位與指定排序。
TC-11 需 migrate 成功後再重跑，並核對中斷恢復證據；缺證據以 PENDING 呈現。
不同快照中完全同值的排序 ties 可有不同列次序，但不改指定排序鍵。

院所 API 現在經 `HAS_FACILITY` 讀取 `醫療院所`；
`GET /api/facilities?county=新竹市&districtCode=1205&type=all&department=內科` 可篩選實際科別。
`GET /api/facilities/departments` 只列實際院所的標準化科別；政府統計選擇器仍保留原 45 項。
醫院四類、診所十類以完整類型清單判斷，13 筆病理中心仍保存但不列入醫院／診所查詢。
目前院所清單與政府 114 年彙總在畫面分別標示，不回填統計數值。

## 失敗後還原

一般中斷優先用同一基準重跑，不需刪除資料。
若需要回到整合前完整狀態，停止應用程式的寫入者及 Neo4j Desktop 的本機 DBMS，
再使用實際 backup artifact 還原目標庫。下列是需明確確認後手動執行的破壞性恢復步驟，本次不自動執行：

```powershell
$env:JAVA_HOME='C:\Users\User\.Neo4jDesktop2\Cache\runtime\zulu21.50.19-ca-jre21.0.11-win_x64'
& "$neoTaskHome\bin\neo4j-admin.bat" database restore "--from-path=$backupTaskPath\neo4j-2026-10-14T16-26-13.backup" --overwrite-destination=true neo4j
```

來源未改動，通常不必恢復 `medicalfacilities`。
啟動 DBMS 後重查節點、統計關係及約束，與 target-before 的資料核對；應用程式版本也需與還原狀態一致。
實體恢復命令已檢查本機 `--help`，但沒有覆寫原資料庫來演練恢復，不宣稱實際還原測試通過。
若新版備份 artifact 名稱不同，使用本次 `--inspect-path` 列出的實際檔名。
