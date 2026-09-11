import { ROLE_CONFIGS } from './roles';
import { AgentCharacter, ChatMessage, RoleType } from '../game/types';

export interface LLMConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  sdk?: string;
}

const MOCK_TOPIC_POOL = [
  'Q3 核心新功能上線與系統架構優化',
  '客戶緊急反饋之系統效能瓶頸處理',
  '重構舊版程式碼與導入 Design System',
  '準備週五 5 點產線正式 Build 發佈',
  '第三方 API 金鑰突發失效之備援處置',
  '全面導入 AI 智慧助理提升研發產能',
  '跨部門溝通效率提升與需求優先級對齊',
  '使用者體驗 (UX) 全面升級與跑版防護'
];

/**
 * 隨機產生辦公室冒險主題
 */
export function generateMockTopic(): string {
  const idx = Math.floor(Math.random() * MOCK_TOPIC_POOL.length);
  return MOCK_TOPIC_POOL[idx] || MOCK_TOPIC_POOL[0];
}

// 預設 Mock 劇本對話庫 (針對辦公室日常情境與會議話題)
const MOCK_DIALOGUE_SCRIPTS: Record<string, string[]> = {
  coffee: [
    '這台咖啡機的豆子是不是又換了？味道有點酸。',
    '咖啡是把 Code 轉換成 Feature 的催化劑！',
    '加雙倍 Espresso，今天看來要奮戰到深夜了。',
    '拿咖啡的時候順便看一眼時程表... 居然還有 5 個 Ticket！',
    '喝完這杯咖啡，我就回去把那個 Blocker 點掉。'
  ],
  general: [
    '今天辦公室的冷氣是不是開得有點太冷了？',
    '剛才看到斜對角的螢幕一直在閃黑屏，是發佈失敗了嗎？',
    '聽說今天下午有免費的下午茶跟手搖飲料！',
    '下班後有人要一起去吃拉麵嗎？',
    '這個週五希望可以順利封版，不要加班。'
  ]
};

// 一般專案主題對話範本
const ROLE_TOPIC_TEMPLATES: Record<string, string[]> = {
  PM: [
    '關於「{topic}」，我先把 Task 拆解到 JIRA 上，大家確認一下排程優先級。',
    '這個「{topic}」的 ETA 訂在週五，有任何風險或 Blocker 請第一時間回報！',
    '大家對「{topic}」還有疑問嗎？沒問題的話我們就按照衝刺計劃執行。',
    '客戶那邊非常關心「{topic}」的進度，我們需要每天保持同步。'
  ],
  RD: [
    '關於「{topic}」，涉及到的架構範圍有點大，我得先看技術文件... post-mortem。',
    '如果要做「{topic}」，現有的資料庫 Schema 需要另外加 Index 效能才跟得上。',
    '這部分程式碼我會盡快在今天出個 Draft PR，發出來請大家幫忙 Code Review！',
    '「{topic}」跑 Local 測試都過關了，等等準備推送到 Staging 環境驗證。'
  ],
  QA: [
    '「{topic}」需要補上新的單元測試與自動化邊界條件腳本！',
    '我等等會針對「{topic}」建立專屬 Test Suite 進行壓力與回歸測試。',
    '發佈前請記得把「{topic}」的測試報告整理好，沒通過的 Bug 一律不能上。',
    '剛才在連擊測試中發現了極端 Exception，先把我記錄的 Issue 點進來看。'
  ],
  UIUX: [
    '關於「{topic}」，從使用者操作流程看，我覺得視覺層級還可以更簡潔。',
    '我已經把「{topic}」最新的 UI 介面草圖更新到 Figma，大家看一下動線順不順。',
    '設計規範一定要保持 Consistent，不能因為急著出版就跑版。'
  ],
  AD: [
    '「{topic}」這波宣傳切入點要夠殺！視覺要讓使用者一眼亮起來！',
    '美術視覺跟動畫效果要跟上「{topic}」的主題格調，給大眾頂級體驗！'
  ],
  INTERN: [
    '關於「{topic}」，需要我幫忙抄寫會議紀錄或者建 Dummy Data 嗎？',
    '學長姐太厲害了！「{topic}」我也想跟著做，在旁學習一下！',
    '收到！我這就去整理「{topic}」的文件與相關案例研究。'
  ],
  BOSS: [
    '「{topic}」關係到我們團隊今年的核心 KPI，這仗必須打贏！',
    '只要成功搞定「{topic}」，這個月加菜、年終獎金翻倍，大家一起衝！',
    '各位同仁，把「{topic}」做好，我們就要向創投與市場證明實力了！'
  ]
};

// 緊急事件 / Bug / 崩潰 / 瓶頸對話範本 (專屬語境與反應)
const ROLE_INCIDENT_TEMPLATES: Record<string, string[]> = {
  PM: [
    '針對緊急事件「{topic}」，優先級拉到 P0！大家立刻暫停次要工作，成立 War Room 專注修復！',
    '這個「{topic}」影響範圍很大，我先通知客服與客戶管理團隊發佈維護公告！',
    '大家搶修「{topic}」辛苦了，有任何資源需要協調我第一時間協助！'
  ],
  RD: [
    '「{topic}」我看一下 Sentry Log 與 Console 堆疊日誌... 好像是狀態沒處理到 null 值。',
    '關於「{topic}」，在我的 Local 環境成功復現了！我現在切 Hotfix Branch 進行防禦性程式碼修正。',
    '已開出針對「{topic}」的修補 PR，請 QA 與 PM 幫忙核對並驗證！'
  ],
  QA: [
    '我抓到了！「{topic}」的復現步驟已整理好，連擊按鈕就會觸發未擷取的 Exception！',
    '正在針對「{topic}」進行全套邊界條件與迴歸測試，確保修復不會引發其他 Side Effect！',
    '針對「{topic}」的 Hotfix 測試已通過，可以安心發佈至 Production！'
  ],
  UIUX: [
    '「{topic}」出現畫面白屏非常傷使用者體驗！我補個友善的載入與錯誤提示畫面！',
    '畫面崩潰時的提示動畫與引導復原按鈕，我已經更新設計樣式給 RD 參考。'
  ],
  AD: [
    '「{topic}」白屏太掃興了！我來繪製一個幽默趣味的維護中 Banner 緩解使用者情緒！',
    '崩潰畫面的吉祥物視覺我已急件補上，讓使用者看到至少笑一下！'
  ],
  INTERN: [
    '學長！「{topic}」需要我幫忙開 Ticket、記錄 Console Log 或是輔助重現嗎？',
    '對不起學長！這個問題好像和我昨天動到的模組有關，我現在立刻幫忙對照 Diff！'
  ],
  BOSS: [
    '「{topic}」非常嚴重！相關團隊全力搶修，問題沒解決前大家都不要走！',
    '搶修「{topic}」辛苦了！今晚加班費照算，宵夜拿鐵我買單，大家加油把難關渡過！'
  ]
};

/**
 * 產生 Mock 對話回應 (支援一般專案與緊急 Incident 雙重範本庫)
 */
export function generateMockResponse(
  speaker: AgentCharacter,
  contextMessages: ChatMessage[],
  topic?: string
): string {
  const roleInfo = ROLE_CONFIGS[speaker.role] || ROLE_CONFIGS['RD'];
  const catchphrases = roleInfo.catchphrases || ['大家一起加油！'];

  // 1. 如果有特定主題 (根據主題性質分配一般範本或緊急 Incident 範本)
  if (topic) {
    const cleanTopic = topic.replace(/^(緊急任務通知|召開會議主題|團隊核心目標)：\s*/, '');
    const isIncident = /Bug|崩潰|白屏|錯誤|漏洞|瓶頸|500|緊急|Hotfix/i.test(cleanTopic);
    const templatePool = isIncident ? ROLE_INCIDENT_TEMPLATES[speaker.role] : ROLE_TOPIC_TEMPLATES[speaker.role];
    const templates = templatePool || ROLE_TOPIC_TEMPLATES[speaker.role];

    if (templates && templates.length > 0) {
      const idx = Math.floor(Math.random() * templates.length);
      const rawTpl = templates[idx] || templates[0];
      return rawTpl.replace('{topic}', cleanTopic);
    }
    return `關於「${cleanTopic}」，我這邊沒問題，大家準備好各自分工，全力完成目標！`;
  }

  // 2. 如果前一句對話有人講話，進行回應
  if (contextMessages && contextMessages.length > 0) {
    const lastMsg = contextMessages[contextMessages.length - 1];
    if (lastMsg && lastMsg.speakerId !== speaker.id) {
      if (lastMsg.speakerRole === 'PM' && (speaker.role === 'RD' || speaker.role === 'QA')) {
        return `針對 ${lastMsg.speakerName} 剛剛說的進度，我們還在評估風險，不能盲目保證 ETA。`;
      }
      if (lastMsg.speakerRole === 'RD' && speaker.role === 'QA') {
        return `${lastMsg.speakerName} 你確定 Local 沒問題？我這隨便一測就點出 Exception 了喔！`;
      }
      if (lastMsg.speakerRole === 'UIUX' && speaker.role === 'RD') {
        return `${lastMsg.speakerName} 要求的這個動畫效果，會增加 DOM 負擔，我先測效能。`;
      }
    }
  }

  // 3. 隨機金句或生活對話
  const isCatchphrase = Math.random() > 0.4;
  if (isCatchphrase && catchphrases.length > 0) {
    const randomIdx = Math.floor(Math.random() * catchphrases.length);
    return catchphrases[randomIdx] || catchphrases[0];
  } else {
    const category = speaker.status === 'coffee' ? 'coffee' : 'general';
    const pool = MOCK_DIALOGUE_SCRIPTS[category] || MOCK_DIALOGUE_SCRIPTS.general;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return item || catchphrases[0] || '大家加油！';
  }
}

/**
 * 呼叫後端 API (/api/chat) 進行 LLM 回覆產生 (包含 Frontend Console Log)
 */
export async function fetchLLMResponse(
  config: LLMConfig,
  speakerRole: RoleType,
  speakerName: string,
  contextMessages: ChatMessage[],
  topic?: string,
  sceneData?: { time: string; totalPeople: number; members: string; topic?: string },
  historySummary?: string
): Promise<string> {
  if (config.provider === 'mock') {
    return generateMockResponse(
      { role: speakerRole, name: speakerName } as AgentCharacter,
      contextMessages,
      topic
    );
  }

  console.log(`[Client AI Agent] Requesting LLM for ${speakerName} (${speakerRole}) via "${config.provider}"...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          providerId: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          speakerRole,
          speakerName,
          contextMessages,
          topic,
          sceneData,
          historySummary
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data.status === 'success' && data.text && typeof data.text === 'string') {
            console.log(`[Client AI Agent] Received LLM response for ${speakerName}: "${data.text}"`);
            return data.text;
          }
        }
      }
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
  } catch (err) {
    console.warn('[Client AI Agent Error] Backend API call failed, fallback to mock:', err);
  }

  console.log(`[Client AI Agent] Fallback to Mock Response for ${speakerName} (${speakerRole})`);
  return generateMockResponse({ role: speakerRole, name: speakerName } as AgentCharacter, contextMessages, topic);
}
