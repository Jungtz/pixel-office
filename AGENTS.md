# AGENTS.md

## 開發指令

```bash
npm run dev      # 同時啟動 Vite (前端 :3000) + tsx server.ts (後端 :3001)
npm run build    # tsc 型別檢查 → vite build 正式建置
npm run preview  # 預覽正式建置
```

- `tsc` 只做型別檢查 (`noEmit: true`)，不產出檔案，真正的打包由 Vite 負責。
- VS Code F5 可直接啟動 Chrome 並自動執行 `npm run dev`（見 `.vscode/launch.json`）。

## 架構

```
前端 (Vite + React 18)          後端 (Express 5, tsx)
     :3000  ── /api/* ──►  :3001
```

- **前端**：`src/main.tsx` → `src/App.tsx`（單一頁面，無路由）
- **後端**：`server.ts`，兩個端點：
  - `GET /api/providers` — 回傳可用 AI provider 列表（含 mock）
  - `POST /api/chat` — 代理 LLM 請求，支援 OpenAI 相容 SDK 與 Ollama；`speakerRole === 'TOPIC'` 時走主題生成模式
- Vite proxy 將 `/api` 轉發到 `http://localhost:3001`，開發時前端直接 fetch `/api/*` 即可。

## 啟動流程（兩階段設定）

1. **SetupModal** — 選角色數量（0-3）與 AI provider
2. **TopicModal** — AI 生成或手選主題
3. 確認後 App.tsx 建立 agents 並啟動 `setInterval` 自主行為循環

## config.json 注意事項

- `config.json` 已加入 `.gitignore`，但前端 `src/services/configService.ts` 直接 `import rawConfig from '../../config.json'`，**會將 provider 設定（含 apiKey）打包進前端 bundle**。
- 新增 provider 或修改 config 結構時，需同步更新 `config.json.example`。
- `getGameLoopConfig()` 有完整的預設值回退，`config.json` 不存在時仍可運作。

## 角色人設

`src/prompts/*.md` 為每個角色（pm、rd、qa、uiux、ad、intern、boss）的 LLM 人設提示，由 `server.ts` 的 `loadRolePrompt()` 讀取並注入 system prompt。新增角色需：
1. 在 `src/services/roles.ts` 的 `ROLE_CONFIGS` 註冊
2. 建立對應的 `src/prompts/{role}.md`
3. 必要時更新 `src/game/types.ts` 的 `RoleType`

## 遊戲核心

- 地圖：`src/game/officeMap.ts` — 24×16 網格
- 尋路：`src/game/pathfinding.ts` — A*（曼哈頓啟發式）
- 渲染：`src/game/gameEngine.ts` — Canvas 2D + requestAnimationFrame
- 精靈：`src/game/sprites.ts` — 程式化像素繪圖
- 音效：`src/services/sound.ts` — Web Audio API 合成復古音效

## 樣式慣例

本專案混用三種樣式方式，無強制規範：
- Tailwind utility class（`className="flex..."`）
- 自訂 CSS class（定義在 `src/index.css`，部分與 Tailwind 功能重疊）
- 內聯 `style={{}}`

`tailwind.config.cjs` 為舊版備份，Vite 實際使用 `tailwind.config.js`（ESM）。修改 Tailwind 設定請改 `.js` 版。

## 此專案目前缺少

- 測試框架（無 vitest / jest / playwright）
- Linter / formatter（無 ESLint / Prettier / Biome）
- CI/CD（無 `.github/workflows/`）
- 路徑別名（所有 import 用相對路徑）
- `noUnusedLocals` 和 `noUnusedParameters` 設為 `false`
