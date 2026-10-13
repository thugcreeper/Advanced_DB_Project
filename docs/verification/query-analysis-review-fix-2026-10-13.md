# 查詢 UI 審查修正

日期：2026-10-13。只修正圖示、分組展開提示及篩選狀態，保留原本欄位、間距與API。

## 修正

- 分組標題及階層選單的三角形／SVG箭頭直接移除，沒有換另一款箭頭。保留整列點擊及展開／收合文字；一般下拉選單的指示未更動。
- summary加入本體list-style:none及display:flex，CSS仍保留WebKit marker重設，樣式失敗時也不出現原生三角形。
- 保留的裝飾SVG加上18px本體width／height、inline尺寸上限及fill／stroke，不再完全依賴CSS。
- HTML的CSS與app入口、篩選及選擇器模組加入資源版本參數，降低新HTML混用舊樣式／模組的風險。未將用戶截圖的確切原因宣稱為已證實的快取問題。
- 未選科別／人員時，統計範圍disabled且不計入條件數；選取後恢復使用，不清除原有選項值。
- 修改條件使用一般status提示，不再呼叫錯誤處理。結果依原行為先清空，避免下載被誤認為新條件結果的舊CSV。
- 結果來源標示採API回傳scope，避免未生效的醫院／診所選項讓結果標示失真。
- 保留44px欄位高度、原有padding／gap、基本／排序分區及窄螢幕布局。不調整結果欄位。

## 檔案

pages/query/index.html、styles.css、statistics-filters.js、app.js；shared/hierarchical-selector.js、hierarchical-selector.css、ui-icons.js；tests/statistics/query-visual.test.cjs。
後端Java、shared/statistics-api.js、Cypher、Neo4j及CSV匯出程式沒有修改。
本報告取代先前視覺報告中「分組箭頭旋轉」的描述；目前分組改為無箭頭文字狀態。

## 驗證

- UI及視覺11組全部通過：45／27分類、收合保留值、完整POST body、鍵盤、清除、重設、未知類別、桌面／390px／320px、scope依賴及中性提示。
- 模擬頁面CSS載入失敗，保留圖示仍不超過20px，summary原生marker為none。
- 查詢及CSV回歸18通過、1失敗、2 TODO；失敗仍是既有TC-08固定預期差異，未改預期數據。
- 已確認18080／18081回傳固定尺寸SVG，HTML無分組箭頭。
- 執行紀錄：docs/verification/artifacts/query-visual-2026-10-13/review-fix.tap、review-regression.tap；CSS失敗截圖css-failure-safe.png。

本次尚未commit，保留既有README.md／.gitignore修改。
