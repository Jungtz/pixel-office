---
name: websearch
description: 通用網頁抓取外掛。主題含http(s)連結時抓第一頁摘要注入討論；同時輸出fetchPageContent等helpers供其他skill（如stock）呼叫。
---

# WebSearch（網頁摘要）

## WHEN TO USE

主題含 `http(s)` 連結時觸發（不限團隊），抓第一頁 800 字摘要注入。
法務團可丟法條連結、資訊團可丟文件連結，直接生效。

## HELPERS（供其他 skill import）

- `fetchPageContent(url)`：`GET {baseUrl}/?url=`，內容過短（≤50 字）視為無效回 null
- `detectFirstUrl(text)`：抓第一個連結並去尾標點

以上全部 fail-soft，服務掛掉回 null，絕不拋錯。

## GUARDS

- 只接受 `http(s)` 開頭 URL；摘要截斷、白空白正規化後注入。
- 後端服務位址預設 `http://localhost:8008`，可用 `WEBSEARCH_URL` 環境變數覆寫。
