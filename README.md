# PixelOffice 像素辦公室

復古 JRPG 風格的 2D 像素辦公室 AI 職場模擬遊戲。AI 代理人會在辦公室中自主走動、閒聊、開會，模擬真實而生動的職場互動。

## 快速開始

```bash
npm install
cp config.json.example config.json   # 編輯 config.json 填入 API 金鑰
npm run dev                          # 開啟瀏覽器 http://localhost:3000
```

VS Code 可直接按 `F5` 啟動（自動執行 `npm run dev` + 開啟 Chrome）。

## 架構

```
前端 (Vite + React 18)  :3000  ── /api/* ──►  後端 (Express 5)  :3001
```

| 指令 | 說明 |
|------|------|
| `npm run dev` | 同時啟動前後端開發伺服器 |
| `npm run build` | tsc 型別檢查 → Vite 正式建置 |
| `npm run preview` | 預覽正式建置 |

## 玩法

1. **團隊配置**：選擇各角色人數（PM、RD、QA、UIUX、AD、Intern、Boss）
2. **選擇 AI**：Mock 模式（內建腳本）或 AI 模式（需設定 API 金鑰）
3. **主題生成**：AI 自動發想辦公室討論主題
4. **觀察互動**：代理人會自主移動、喝咖啡、拜訪同事、觸發對話
5. **手動操作**：召開會議、派發任務、觸發隨機事件

## 設定檔

`config.json`（從 `config.json.example` 複製）：

```json
{
  "gameLoop": {
    "heartbeatIntervalMs": 3000,
    "behaviorWeights": { "goCoffee": 0.3, "visitColleague": 0.3, "stayDesk": 0.4 },
    "dialogueTrigger": { "minIntervalMs": 6000, "chance": 0.4 }
  },
  "models": {
    "model": "agnes-ai/agnes-2.0-flash"
  },
  "providers": {
    "agnes-ai": {
      "sdk": "openai",
      "apiKey": "YOUR_API_KEY",
      "baseURL": "https://apihub.agnes-ai.com/v1",
      "defaultModel": "agnes-2.0-flash"
    }
  }
}
```

- `models.model`：`"provider/model"` 格式直接使用，或單純 provider ID 時自動取 `defaultModel`
- `providers`：支援 OpenAI 相容 SDK 與 Ollama
- `config.json` 已加入 `.gitignore`，請勿提交金鑰

## 專案結構

```
src/
├── App.tsx                    # 主應用程式（遊戲循環、狀態管理）
├── main.tsx                   # React 進入點
├── index.css                  # 自訂 CSS（與 Tailwind 混用）
├── components/
│   ├── SetupModal.tsx         # 團隊配置彈窗
│   ├── TopicModal.tsx         # AI 主題生成彈窗
│   ├── OfficeCanvas.tsx       # Canvas 遊戲畫面
│   ├── DialogueBox.tsx        # 對話框（DQ 風格）
│   ├── ControlPanel.tsx       # 頂部控制列
│   └── ChatLog.tsx            # 歷史對話紀錄
├── game/
│   ├── types.ts               # 核心型別定義
│   ├── officeMap.ts           # 24×16 地圖
│   ├── pathfinding.ts         # A* 尋路
│   ├── sprites.ts             # 像素精靈繪圖
│   └── gameEngine.ts          # Canvas 遊戲迴圈
├── services/
│   ├── aiAgent.ts             # LLM API 呼叫
│   ├── configService.ts       # config.json 讀取
│   ├── roles.ts               # 角色設定
│   └── sound.ts               # Web Audio 音效
└── prompts/                   # 各角色 LLM 人設提示（.md）
server.ts                      # Express 後端（API 代理）
```

## 新增角色

1. 在 `src/services/roles.ts` 的 `ROLE_CONFIGS` 中註冊
2. 建立 `src/prompts/{role}.md` 人設提示檔
3. 必要時更新 `src/game/types.ts` 的 `RoleType`

## 技術棧

- **前端**：React 18、Vite 5、Tailwind CSS 3、Canvas 2D、Web Audio API
- **後端**：Express 5、tsx
- **字型**：Press Start 2P、DotGothic16、Noto Sans TC
