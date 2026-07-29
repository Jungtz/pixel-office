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

// 角色專屬多樣化主題回應庫 (消除重複機器人發言)
const ROLE_TOPIC_TEMPLATES: Record<RoleType, string[]> = {
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

/**
 * 產生 Mock 對話回應 (支援豐富的多樣化主題範本)
 */
export function generateMockResponse(
  speaker: AgentCharacter,
  contextMessages: ChatMessage[],
  topic?: string
): string {
  const roleInfo = ROLE_CONFIGS[speaker.role] || ROLE_CONFIGS['RD'];
  const catchphrases = roleInfo.catchphrases || ['大家一起加油！'];

  // 1. 如果有特定主題 (優先挑選角色專屬主題範本)
  if (topic) {
    const templates = ROLE_TOPIC_TEMPLATES[speaker.role];
    if (templates && templates.length > 0) {
      const idx = Math.floor(Math.random() * templates.length);
      const rawTpl = templates[idx] || templates[0];
      return rawTpl.replace('{topic}', topic);
    }
    return `關於「${topic}」，我這邊沒問題，大家準備好各自分工，全力完成目標！`;
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
  topic?: string
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
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        providerId: config.provider,
        speakerRole,
        speakerName,
        contextMessages,
        topic
      })
    });

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
  } catch (err) {
    console.warn('[Client AI Agent Error] Backend API call failed, fallback to mock:', err);
  }

  console.log(`[Client AI Agent] Fallback to Mock Response for ${speakerName} (${speakerRole})`);
  return generateMockResponse({ role: speakerRole, name: speakerName } as AgentCharacter, contextMessages, topic);
}
