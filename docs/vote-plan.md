# 投票功能實作計畫

## 1. 背景與規格確認

- 動機：開會流程有集合討論＋log，但沒有任何「結果」UI；投票補上缺口
- 討論三型態：二元（贊成／反對／棄權）、多選（A／B／C）、開放（無正解，只總結＋立場分佈）
- 已確認：三模式一次做；使用者當主席不投票；手動按鈕＋收尾自動問；最後收斂一個結論並顯示

## 2. 資料模型（`src/game/types.ts` 新增）

- `VoteMode = 'binary' | 'multi' | 'open'`、`VoteStatus = 'collecting' | 'pending_ruling' | 'done'`
- `VoteOption { id, label }`
- `VoteRecord { agentId, agentName, role: RoleType, choiceId: string | null（開放模式為 null）, reason }`
- `VoteSession { id, topic, mode: VoteMode, options: VoteOption[], records: VoteRecord[], process?: string, conclusion?, followups?: string[], winnerOptionId?: string | null（多選獲勝項，平票為 null）, ruling?: 'passed' | 'rejected' | 'tied' | 'concluded', status: VoteStatus, createdAt: string }`
- 棄權為獨立選項，不算缺席

## 3. 前端

- `VoteModal`（新）：議案預設當前主題；模式三選一；多選選項手填＋「AI 建議選項」鈕（打後端新增 `OPTIONS` action，見 §4，不可沿用 TOPIC）；投票人預設全 agents **並自動過濾 `isUser` 扮演角**（主席不投票，AI 不代投真人）
- `ControlPanel`：開會鈕旁加投票鈕
- 收集器：逐票呼叫後端，**受控並行 Concurrency = 2**（防地端 Ollama 塞車／外部 Rate Limit），附進度條「正在收集 RD_1 表態… (1/6)」
- 收尾自動問：既有 `remaining <= 2` 收斂提示處，`remaining <= 0` 時先經 `classifyTopicForVote(topic)`（`src/services/topicType.ts`）判斷；回 `skip`（搶修／同步／分工／社交型主題）則不顯示投票選項，只問重置或重開。`votable` 才彈確認是否就地投票（只問，不自動開）。手動投票不受分類影響
- `VoteResult`（新）：頂部定案結論區（三段條列：討論過程 → 定案結論 → 建議深入討論的項目）＋長條計票＋每人選擇與理由
  - 二元：贊成＞反對→通過，反之否決
  - 多選：最高票即定案
  - 開放：主持人總結即結論，不排名次
  - 平票→「待主席裁決」＋主席裁定鈕（你點選最終選項，不算票，只定結論）

- 主聊天流連動：發起與結束時插入系統訊息（🗳️ 主席發起投票／📢 表決通過＋結論），保留對話脈絡
- 像素反饋：投票當下觸發角色頭頂 `emojiBubble`（贊成 ⭕／反對 ❌／棄權 ⚪／思考中 💭）

## 4. 後端（`server.ts`，仿 TOPIC 特規，但三處不可照抄）

- `VOTE` action：system prompt 要求只回 JSON `{choice, reason}`。**結構化分支必須跳過既有引號清除**（`server.ts:400` 的 `.replace(/["「」]/g, '')` 會剝掉 JSON 雙引號導致必定解析失敗）：改以 regex 提取 JSON 區塊（如 `/\{[\s\S]*\}/`）再 `JSON.parse`，choice 白名單校驗，解析失敗重試一次，再失敗記棄權＋理由「未表態」
- `CONCLUDE` action：撰寫三段式摘要，回傳 JSON `{process, conclusion, followups}`（process：討論過程 2-4 點條列；conclusion：定案結論；followups：1-3 個建議深入項目，無則空陣列）。前端另傳 `contextText`（近期討論摘錄 2000 字內）供回顧過程；開放模式的總結也走此 action。**主持人由前端既有 `findLeader(agents, currentTeam)` 算出**，把該 agent 的 name／role 當 speaker 傳入（後端不存房間狀態，無此函式）
- `OPTIONS` action（新增）：接收議案 topic，回傳繁體中文候選清單（如 `["方案A","方案B","方案C"]`），同走 JSON 提取＋解析（不可沿用 TOPIC，其 prompt 寫死只會隨機生新主題）
- mock 降級**留在前端**（沿用既有職責劃分：mock 由 `aiAgent.ts` 直接攔截不發 HTTP）：新增 `generateMockVoteRecord()` 與 `generateMockConclusion()`，理由套前端既有的 `ROLE_TOPIC_TEMPLATES`，傾向按角色 interests 與主題關鍵字重合度落票，無命中則棄權，離線可運作

## 5. 存檔（`src/services/chatLogService.ts`＋`server.ts` 聊天紀錄端點）

- `ChatLogDetail` 加 `votes: VoteSession[]`；接續歷史時結果面板唯讀回看
- Markdown 持久化：`POST /api/chat-log` 接受 `votes` 陣列，檔尾寫人類可讀 `## 投票結果` 區段（議案／逐人表態／討論過程／定案結論／建議深入）＋ HTML 註解保存結構化 JSON（不破壞人類閱讀）：`<!-- VOTES_DATA: [...] -->`；`GET /api/chat-log` 以 regex 解析還原 votes 與 `## 前情提要`，舊檔無註解則回空陣列／空字串
- 接續摘要按需生成（`ResumeModal`）：檔內已有摘要（含表決結論）直接預填為檔案版，不自動打 LLM；僅無摘要、接續主題變更（提示重算）、用戶按重新生成時才呼叫 `/api/chat-logs/summary`；`App` 自動存檔帶 `votes`，接續還原寫回 `votesRef`，後續存檔接力寫檔

## 6. 邊界

- 投票中暫停自主發言循環（仿開會 `isActive` 旗標）；開會中可直接對會議主題投票
- 重複投票覆蓋前票；零 agents 不開投直接提示

## 7. 驗證

- `npm run build`＋三模式×（mock／真 LLM）手動各一次＋接續歷史回看
