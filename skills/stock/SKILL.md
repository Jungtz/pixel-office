---
name: stock
description: 台股即時情報外掛。當討論主題涉及台股個股（含4碼代號或前端指定的stockId）時使用，注入現價、均線、法人、資券、分點、財報、重訊、新聞全文與viewer AI報告摘要。
---

# Stock（股票情報）

## WHEN TO USE

主題含台股代號（4 碼數字，如 `2330`，排除 1900–2100 年份數字）或 request body 帶 `stockId` 時觸發。
`stockId` 優先於主題偵測。

## WHAT IT DOES

並行抓取以下來源並組裝成 `【即時台股情報】` prompt 區塊（約 1500–2000 字）：

- `stock-gateway`：snapshot 現價、近 45 天 K 線（算 MA5/MA20＋多空排列）、三大法人近 5 日、
  融資券、分點最新、fundamentals、最新財報、MOPS 重訊、相關新聞標題
- `TWSE 官方直連備援`（無需認證）：gateway 現價＋K 線缺失時才打 `STOCK_DAY` 取整月 OHLC，
  補現價（最後一根收盤）＋均線；知識來源見 `w-data-ais-skill/fetch-tw-data-stock`
- 新聞全文：取前 2 則有連結者，經 `websearch` skill 抓取、各截 500 字
- `stock-viewer` 公開報告 `/report/{代號}/md`：萃取決策／結論段落

## GUARDS

- 同代號 5 分鐘快取，同主題連續發言不重打（保護 Shioaji 日配額）。
- 任一段來源失敗只略過該段；全掛回空字串，對話降級為無外掛模式。
- 區塊尾固定附「僅供角色扮演討論，非投資建議」。
