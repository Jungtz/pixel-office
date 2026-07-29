import { ROLE_CONFIGS } from './roles';
import { AgentCharacter, ChatMessage, RoleType } from '../game/types';

export interface LLMConfig {
  provider: 'mock' | 'openai' | 'gemini';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
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

/**
 * 產生 Mock 對話回應
 */
export function generateMockResponse(
  speaker: AgentCharacter,
  contextMessages: ChatMessage[],
  topic?: string
): string {
  const roleInfo = ROLE_CONFIGS[speaker.role];
  const catchphrases = roleInfo.catchphrases;

  // 1. 如果有特定主題 (例如 Boss 指派或會議)
  if (topic) {
    if (topic.includes('上線') || topic.includes('發佈')) {
      if (speaker.role === 'PM') return `關於「${topic}」，我們今天下午 5 點必須出測試 Build，ETA 絕不能延誤！`;
      if (speaker.role === 'RD') return `「${topic}」的 PR 還在被 Code Review，而且部署腳本好像有點問題...`;
      if (speaker.role === 'QA') return `「${topic}」還有 2 個 High 級別的 Bug 沒解決，我不建議強行上線！`;
      if (speaker.role === 'UIUX') return `發佈前請確定 UI 元件沒有在小螢幕跑版，畫面留白要維持！`;
      if (speaker.role === 'AD') return `上線的 Banner 視覺必須給力，讓人一眼就 WOW 出聲來！`;
      if (speaker.role === 'INTERN') return `學長！「${topic}」需要我幫忙做什麼測試或紀錄嗎？`;
      if (speaker.role === 'BOSS') return `「${topic}」是我們本季度的核心目標，大家全力衝刺！`;
    }

    if (topic.includes('Bug') || topic.includes('崩潰') || topic.includes('問題')) {
      if (speaker.role === 'QA') return `我找到復現步驟了！連點三個按鈕就會觸發 NullPointer！`;
      if (speaker.role === 'RD') return `這不可能啊，在我的 Local 環境跑都很正常... 我看一下 Sentry Log。`;
      if (speaker.role === 'PM') return `這個 Bug 會影響發佈嗎？能不能先做個 Workaround？`;
      if (speaker.role === 'UIUX') return `順便檢查一下錯誤提示彈窗的樣式，不要用瀏覽器預設 alert！`;
      if (speaker.role === 'AD') return `崩潰畫面的 Icon 要設計得幽默一點，緩解使用者情緒。`;
    }

    if (topic.includes('需求') || topic.includes('改動') || topic.includes('新功能')) {
      if (speaker.role === 'PM') return `客戶剛剛緊急提出了這個新需求，我覺得很有價值，今天加進去！`;
      if (speaker.role === 'RD') return `又改需求？！這等於要重構底層 API，時程要多加三天！`;
      if (speaker.role === 'QA') return `需求改動的話，之前的 Test Cases 全部都要重新執行一遍...`;
      if (speaker.role === 'UIUX') return `我先在 Figma 上拉個 Wireframe，大家確定互動流程再動手。`;
    }
  }

  // 2. 如果前一句對話有人講話，進行回應
  if (contextMessages.length > 0) {
    const lastMsg = contextMessages[contextMessages.length - 1];
    if (lastMsg.speakerId !== speaker.id) {
      if (lastMsg.speakerRole === 'PM' && (speaker.role === 'RD' || speaker.role === 'QA')) {
        return `針對 ${lastMsg.speakerName} 剛剛說的進度，我們還在評估風險，不能盲目保證 ETA。`;
      }
      if (lastMsg.speakerRole === 'RD' && speaker.role === 'QA') {
        return `${lastMsg.speakerName} 你確定 Local 沒問題？我這隨便一測就點出 Exception 了喔！`;
      }
      if (lastMsg.speakerRole === 'UIUX' && speaker.role === 'RD') {
        return `${lastMsg.speakerName} 要求的這個微微動畫效果，會增加 DOM 渲染負擔，我先測效能。`;
      }
    }
  }

  // 3. 隨機金句或生活對話
  const isCatchphrase = Math.random() > 0.4;
  if (isCatchphrase) {
    const randomIdx = Math.floor(Math.random() * catchphrases.length);
    return catchphrases[randomIdx];
  } else {
    const category = speaker.status === 'coffee' ? 'coffee' : 'general';
    const pool = MOCK_DIALOGUE_SCRIPTS[category];
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

/**
 * 呼叫真實大語言模型 API (OpenAI 或 Gemini)
 */
export async function fetchLLMResponse(
  config: LLMConfig,
  speakerRole: RoleType,
  speakerName: string,
  contextMessages: ChatMessage[],
  topic?: string
): Promise<string> {
  if (config.provider === 'mock' || !config.apiKey) {
    return generateMockResponse(
      { role: speakerRole, name: speakerName } as AgentCharacter,
      contextMessages,
      topic
    );
  }

  const roleConfig = ROLE_CONFIGS[speakerRole];
  const systemPrompt = `${roleConfig.systemPrompt} 你現在的名字是 ${speakerName}。請以一到兩句話繁體中文簡短回答，保持極強的人物性格特點。不要輸出前綴。`;

  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.slice(-5).map(m => ({
      role: m.speakerRole === speakerRole ? 'assistant' : 'user',
      content: `${m.speakerName} (${m.speakerRole}): ${m.text}`
    }))
  ];

  if (topic) {
    messagesPayload.push({
      role: 'user',
      content: `當前辦公室討論主題：${topic}。請發表你的看法。`
    });
  }

  try {
    if (config.provider === 'openai') {
      const response = await fetch(`${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-3.5-turbo',
          messages: messagesPayload,
          max_tokens: 100,
          temperature: 0.8
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || generateMockResponse({ role: speakerRole } as AgentCharacter, contextMessages, topic);
    } else if (config.provider === 'gemini') {
      // Gemini API call
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n對話歷史:\n${messagesPayload.map(m => `${m.role}: ${m.content}`).join('\n')}` }]
          }]
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || generateMockResponse({ role: speakerRole } as AgentCharacter, contextMessages, topic);
    }
  } catch (err) {
    console.warn('LLM API Error, fallback to mock:', err);
  }

  return generateMockResponse({ role: speakerRole } as AgentCharacter, contextMessages, topic);
}
