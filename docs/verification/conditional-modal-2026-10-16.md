# 條件式 Modal、分類概況與成功查詢快照（2026-10-16）

## 本次修正

- 刪除篩選頁指定的 AND 說明及結果底部資料口徑／年度長段落。
- 固定「科別統計／更多指標」改為條件式分頁定義：overview 固定；departments 只在成功查詢有科別；personnel 只在成功查詢有人員。每次開啟重建適用分頁、移除所有舊節點，預設 overview；動態數量的鍵盤循環適用 1／2／3 個分頁。
- 概況改為「人口與土地、醫療資源、醫事人員、所得與統計年度」，各分類有標題及左線。每項為名稱／數值／單位的緊湊資料列，桌面約兩項一列且依自然內容寬度，手機一項一列。保留 21px／27px 字級、細框與交錯背景，刪除舊 Flexbox 卡片系統。
- 表單修改、查詢開始、失敗與取消都不清除成功結果。columns 與資料只在成功回應時更新，Modal 的選科／人員／scope 來自同次 body、appliedFilters 及 row 快照，不讀表單當下值。使用者取消內科但未查詢，仍可查看先前的內科結果及匯出 CSV。

## 後端與缺值規則

Repository 原本已計算 hospitalPersonnel／clinicPersonnel，但 coalesce(sum(...),0) 會把缺關係轉成 0。現在以 count(r.數量) 判斷是否真的有數值記錄；無記錄回 null，實際記錄 0 保留 0。

- specialties 的 hospital／clinic 保留缺值；total 只有兩者皆已知才能相加。不是用 HAS_DEPARTMENT 取代 RECORD_DEPARTMENT。
- 新增 personnelStatistics（category、hospital、clinic、total），直接由 RECORD_PERSONNEL、r.類型、r.數量取得，沒有前端猜測或從總數反推。
- 所選範圍的匹配仍依已知記錄的正數及範圍，selected／personnel 的 OR／AND、排序、門檻意義未改。前端人員 all 摘要標示「已知人數」，避免把部分已知數量誤稱完整合計；Modal 完整合計若缺分項則顯示未提供。
- API 維持現有單科 request 相容與首科排序欄位；刪除前端不再使用的純量回退、Service 針對舊純量 mock 的分支，以及 Repository 舊三字串 rows 包裝，統一走參數化 search。

Aura 唯讀比對：竹北市護理師為醫院 1,582、診所 487、合計 2,069；內科 5／12／17、外科 4／11／15。另確認臺南東區中醫婦科只有診所記錄 7，無醫院記錄；因此醫院／完整合計顯示未提供，不能聲稱醫院為 0。其已知正數選取仍為 7，符合原本篩選規則。

## 檔案

- pages/query/app.js：成功結果與表單暫存分開。
- pages/query/columns.js：成功條件快照、分項來源與分類概況資料描述；移除純量回退。
- pages/query/results.js：可擴充條件式分頁、分類資料列、動態鍵盤循環、共用分項表格。
- pages/query/styles.css／index.html：移除兩段文字、舊卡片樣式，改分類式概況與手機完整分頁名稱換列。
- DistrictStatisticsRepository.java／DistrictStatisticsService.java：人員分項與缺值、統一 search。
- StatisticsApiContractTest／StatisticsReadOnlyTest／StatisticsAuraReadOnlyTest：依真實陣列結構驗證，新增來源與缺值檢查。
- tests/statistics/statistics-modal.test.cjs／multi-filter.test.cjs／personnel-breakdown.test.cjs：動態分頁、四種組合、草稿／成功／失敗／取消、原始 Cypher 分項比對、概況及 CSV。
- 刪除 tests/statistics/live.test.cjs（固定 25 欄 CSV／舊欄位位置／舊清空策略）及 positive-selection.test.cjs（初版修補重複案例）；有效醫師數學一致性測試併入 multi-filter，新 Modal 測試涵蓋失敗及取消後的成功快照。未刪除有效的前端、API 或安全測試。

## 測試證據

- 四組：未選→只有概況；只科別→概況＋科別；只人員→概況＋人員；兩者→三頁。每次重開及換行政區回概況，各表逐格等於該筆 API，Modal 操作額外 API 請求為 0。
- 取消已選科別、加入人員但不查詢，表格與 Modal 仍顯示前次科別；成功重查才移除科別並新增人員。再次清除人員成功重查只剩概況，不留隱藏舊分頁。
- 模擬 DATABASE_UNAVAILABLE 及延遲回應被取消，都保留舊成功資料，晚到回應不覆寫。
- 三種 scope 的 personnelStatistics 逐列與獨立 RECORD_PERSONNEL 查詢比對；缺醫院記錄維持 null。科別 OR／AND 與各範圍仍與獨立原始記錄 oracle 相同。
- 1440、1100、390、320px 概況的分類、兩項／單項、字級、背景、細框、無裁切、焦點、內部捲動與關閉驗證；最後手機分頁以完整名稱換列再重驗。
- CSV 保留現在成功結果與排序；多科仍匯出完整分項。單科缺值匯出空欄，與實際 0 分開，不產生 undefined／null／物件字串。

實測產物在 Git 忽略的 tests/integration/artifacts/conditional-overview-*.png、conditional-modal-evidence.json。

## 發布限制

沒有寫入、刪除、重新匯入或修改 Neo4j Schema。未 commit／push／部署。18091 預覽已更新；部署時需同時更新後端及前端以取得新增人員分項。已以瀏覽器手機尺寸與鍵盤實測，實體手機及正式螢幕閱讀器尚未實測。

## 最終結果

- Java + 實際 Aura 唯讀：57 通過、0 失敗、0 錯誤、0 跳過；AURA_READ_TESTS=true，Maven offline package。同時通過三種範圍／OR／AND、直接 Repository、分項來源與缺值測試，未對資料庫寫入。
- 前端／資料流程：51 個不同測試通過、0 失敗、0 跳過、0 TODO。第一組 statistics-modal（14）＋multi-filter（10）共 24 項；第二組 personnel-breakdown（3）＋frontend（8）＋query-ui（8）＋query-visual（3）＋cypher/ui（5）共 27 項。Node --test --test-concurrency=1，BASE 明確指向 http://127.0.0.1:18091。
- 手機完整分頁名稱換列後另重跑 3 項；最終「已知人數」摘要與清理後再重跑快照／缺值 2 項；5 項重驗全通過，不重複計入 51。
- 最終 Maven package -DskipTests BUILD SUCCESS，更新前端資源並重啟本次預覽；此封裝步驟沒有將略過的測試算為通過。
- git diff --check 通過；來源中已無指定兩段文字、舊卡片樣式、舊 scalar fallback 及舊 rows 包裝。

第一輪移除 Service 純量 mock 回退後，有兩個舊測試仍只設定 specialty 純量而失敗；已將 fixture 更新為實際 specialties 陣列並保留原有斷言／預期與正數規則，重跑 57 項全通過。
