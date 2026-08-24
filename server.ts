import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface ProviderConfig {
  type?: string;
  sdk?: string;
  apiKey?: string;
  description?: string;
  baseURL?: string;
  defaultModel?: string;
}

interface AppConfig {
  port?: number;
  providers?: Record<string, ProviderConfig>;
}

/**
 * 讀取 config.json 檔
 */
function loadConfig(): AppConfig {
  const configPath = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse config.json:', err);
    }
  }
  return { providers: {} };
}

/**
 * 讀取角色專屬人設 Markdown 檔 (src/prompts/{role}.md)
 */
function loadRolePrompt(roleId: string): string {
  const promptPath = path.join(process.cwd(), 'src', 'prompts', `${roleId.toLowerCase()}.md`);
  if (fs.existsSync(promptPath)) {
    try {
      return fs.readFileSync(promptPath, 'utf-8').trim();
    } catch (err) {
      console.error(`Failed to read prompt file for ${roleId}:`, err);
    }
  }
  return `你是一名 ${roleId}。說話請保持該職位的性格特點。`;
}

interface SceneData {
  time: string;
  totalPeople: number;
  members: string;
  topic?: string;
  roundNumber?: number;
  maxRounds?: number;
  remaining?: number;
}

function loadScenePrompt(data: SceneData): string {
  const promptPath = path.join(process.cwd(), 'src', 'prompts', 'scene.md');
  let template = '';
  if (fs.existsSync(promptPath)) {
    try {
      template = fs.readFileSync(promptPath, 'utf-8').trim();
    } catch (err) {
      console.error('Failed to read scene prompt file:', err);
    }
  }
  if (!template) {
    template = '【AI 辦公室大亂鬥 — 當前場景】\n現在時間：{{time}}\n辦公室成員（共 {{totalPeople}} 人）：\n{{members}}\n{{topicLine}}{{roundInfo}}';
  }

  const topicLine = data.topic ? `目前討論主題：「${data.topic}」` : '目前無特定討論主題。';

  let roundInfo = '';
  if (data.roundNumber && data.maxRounds && data.maxRounds > 0) {
    const remaining = data.remaining ?? (data.maxRounds - data.roundNumber + 1);
    if (remaining <= 1) {
      roundInfo = `\n\n⚡ 這是最後一輪發言！你必須說出告別語或最終結論，為整場討論劃下句點。不要 @點名任何人，讓對話自然結束。`;
    } else if (remaining <= data.totalPeople) {
      roundInfo = `\n\n⚠️ 對話進入收尾階段，僅剩 ${remaining} 輪！你必須針對主題做出個人結論或建議，不要再提出新問題或 @點名他人發起新話題。`;
    } else {
      roundInfo = `\n（第 ${data.roundNumber} / ${data.maxRounds} 輪）`;
    }
  }

  return template
    .replace('{{time}}', data.time)
    .replace('{{totalPeople}}', String(data.totalPeople))
    .replace('{{members}}', data.members)
    .replace('{{topicLine}}', topicLine)
    .replace('{{roundInfo}}', roundInfo);
}

/**
 * GET /api/providers - 提供前端可選的 AI Provider 列表
 */
app.get('/api/providers', (req: Request, res: Response) => {
  const config = loadConfig();
  const list = [
    {
      id: 'mock',
      description: '即插即用 (Mock AI)',
      sdk: 'mock',
      defaultModel: 'mock-script'
    }
  ];

  if (config.providers) {
    Object.entries(config.providers).forEach(([key, val]) => {
      list.push({
        id: key,
        description: val.description || key,
        sdk: val.sdk || 'openai',
        defaultModel: val.defaultModel || ''
      });
    });
  }

  res.json(list);
});

/**
 * GET /api/model-config — 回傳 models 設定（不洩漏 apiKey）
 */
app.get('/api/model-config', (req: Request, res: Response) => {
  const config = loadConfig();
  const modelsConfig = config.models;
  const modelConfig = modelsConfig?.model;

  if (!modelConfig || typeof modelConfig !== 'string') {
    return res.json({ provider: '', model: '', label: '' });
  }

  if (modelConfig.includes('/')) {
    const slashIdx = modelConfig.indexOf('/');
    const providerId = modelConfig.slice(0, slashIdx);
    const modelName = modelConfig.slice(slashIdx + 1);
    return res.json({
      provider: providerId,
      model: modelName,
      label: modelsConfig?.label || modelName
    });
  }

  const provider = config.providers?.[modelConfig];
  const fallbackModel = provider?.defaultModel || '';
  return res.json({
    provider: modelConfig,
    model: fallbackModel,
    label: modelsConfig?.label || fallbackModel
  });
});

/**
 * POST /api/test-key — 驗證使用者輸入的 API Key 是否有效
 */
app.post('/api/test-key', async (req: Request, res: Response) => {
  try {
    const { providerId, apiKey: frontendApiKey } = req.body;
    if (!providerId || !frontendApiKey) {
      return res.json({ valid: false, error: '缺少 providerId 或 apiKey' });
    }

    const config = loadConfig();
    const provider = config.providers?.[providerId];
    if (!provider) {
      return res.json({ valid: false, error: `找不到 provider: ${providerId}` });
    }

    const baseUrl = (provider.baseURL || (provider.sdk === 'ollama' ? 'https://ollama.com' : 'https://api.openai.com/v1')).replace(/\/$/, '');
    const endpoint = provider.sdk === 'ollama' ? `${baseUrl}/api/chat` : `${baseUrl}/chat/completions`;
    const model = provider.defaultModel || (provider.sdk === 'ollama' ? 'gemma4:31b-cloud' : 'gpt-3.5-turbo');

    const messagesPayload = [
      { role: 'user', content: 'ping' }
    ];

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${frontendApiKey}`
      },
      body: JSON.stringify(
        provider.sdk === 'ollama'
          ? { model, messages: messagesPayload, stream: false }
          : { model, messages: messagesPayload, max_tokens: 1, temperature: 0 }
      ),
      signal: AbortSignal.timeout(15000)
    });

    if (response.ok) {
      return res.json({ valid: true });
    }

    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      if (parsed.error?.message) {
        errorMsg = parsed.error.message;
      }
    } catch {}

    return res.json({ valid: false, error: errorMsg });
  } catch (err: any) {
    return res.json({ valid: false, error: err.message || '連線失敗' });
  }
});

/**
 * POST /api/chat - 由後端伺服器進行 LLM API 呼叫 (支援角色發言與 🎲 AI 主題自動發想)
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { providerId, speakerRole, speakerName, contextMessages, topic, sceneData, model: requestedModel, apiKey: frontendApiKey } = req.body;
    const config = loadConfig();
    const provider = config.providers?.[providerId];
    const activeModel = requestedModel || provider?.defaultModel || '';
    const effectiveApiKey = provider?.apiKey || frontendApiKey || '';

    const isTopicGen = speakerRole === 'TOPIC' || speakerName === 'TopicGenerator';

    if (!provider || providerId === 'mock' || !effectiveApiKey) {
      console.log(`[LLM Call] Mode: Mock AI | Type: ${isTopicGen ? '🎲 Topic Gen' : '💬 Dialogue'} | Speaker: ${speakerName}`);
      return res.json({ status: 'mock' });
    }

    let systemPrompt = '';
    let messagesPayload: any[] = [];

    if (isTopicGen) {
      systemPrompt = '你是一名資深的科技公司 CEO。請以繁體中文直接輸出一個 15 字以內的辦公室專案討論主題或緊急任務（例如：客戶極端效能瓶頸處置、準備週五產線 Build 發佈）。直接輸出主題即可，絕不要輸出引號、問候語或任何額外說明。';
      messagesPayload = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '請發想並輸出一個全新的辦公室專案討論主題。' }
      ];
    } else {
      const basePrompt = loadRolePrompt(speakerRole);
      const sceneBlock = sceneData ? `\n\n${loadScenePrompt(sceneData)}` : '';

      let topicLine = '';
      let memberNamesStr = '';
      if (topic) {
        memberNamesStr = sceneData?.members
          ? sceneData.members.split('\n').map(line => {
              const m = line.match(/\]\s+(\S+)/);
              return m ? m[1] : '';
            }).filter(Boolean).join('、')
          : '';
        topicLine = `當前討論主題：「${topic}」\n`;
      }

      systemPrompt = `${basePrompt}\n\n${topicLine}${sceneBlock}\n\n【重要】你現在的名字是 ${speakerName}。請直接針對對話紀錄中上一人的發言內容做出具體回應，不要離題自說自話，不要重述主題或角色設定。保持一到兩句話繁體中文，展現角色性格。若需點名請使用實際成員名稱（${memberNamesStr}），不要自己編造不存在的人名。你的回覆中絕對不要包含你自己的名字或任何前綴（例如「BOSS_1 (BOSS):」），直接輸出純對話內容。`;
      console.log(`[SceneCtx] : ${sceneData ? `已載入 (${sceneData.totalPeople}人, ${sceneData.time})` : '無場景資訊'}`);
      messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...(contextMessages || []).slice(-8).map((m: any) => {
          // 清理 text 中殘留的 [SpeakerName] 前綴，避免逐輪累積
          const cleanText = m.text.replace(/^(\[\w+\]\s*)+/g, '').trim();
          return {
            role: m.speakerRole === speakerRole ? 'assistant' : 'user',
            content: `[${m.speakerName}] ${cleanText}`
          };
        })
      ];

      // OpenAI 相容 API 要求最後一條訊息必須是 user role
      if (messagesPayload[messagesPayload.length - 1].role === 'assistant') {
        messagesPayload.push({ role: 'user', content: '請針對上述對話繼續回應。' });
      }

    }

    const baseUrl = (provider.baseURL || (provider.sdk === 'ollama' ? 'https://ollama.com' : 'https://api.openai.com/v1')).replace(/\/$/, '');
    const endpoint = provider.sdk === 'ollama' ? `${baseUrl}/api/chat` : `${baseUrl}/chat/completions`;

    // 格式化 Console Log 輸出
    if (isTopicGen) {
      console.log('\n=================== 🎲 AI Topic Generation ===================');
      console.log(`[Provider] : ${providerId} (${provider.description || providerId})`);
      console.log(`[SDK/Model]: ${provider.sdk} / ${activeModel || provider.defaultModel}`);
      console.log(`[Endpoint] : ${endpoint}`);
    } else {
      console.log('\n=================== 🤖 LLM Request ===================');
      console.log(`[Speaker]  : ${speakerName} (${speakerRole})`);
      console.log(`[Prompt MD]: src/prompts/${speakerRole.toLowerCase()}.md`);
      console.log(`[Provider] : ${providerId} (${provider.description || providerId})`);
      console.log(`[SDK/Model]: ${provider.sdk} / ${activeModel || provider.defaultModel}`);
      console.log(`[Endpoint] : ${endpoint}`);
      if (topic) console.log(`[Topic]    : ${topic}`);
    }

    const LLM_TIMEOUT_MS = 120000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    let response: any;
    try {
      if (provider.sdk === 'ollama') {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          body: JSON.stringify({
            model: activeModel || 'gemma4:31b-cloud',
            messages: messagesPayload,
            stream: false
          }),
          signal: controller.signal
        });
      } else {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          body: JSON.stringify({
            model: activeModel || 'gpt-3.5-turbo',
            messages: messagesPayload,
            max_tokens: 150,
            temperature: 0.8
          }),
          signal: controller.signal
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(`[HTTP Status]: ${response.status} ${response.statusText}`);

    const resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch (e) {}

    const text = data.message?.content || data.choices?.[0]?.message?.content;
    if (text && typeof text === 'string') {
      const cleanResult = text
        .replace(/^(\[\w+\]\s*)+/g, '')          // 剝掉 [AD_1] [AD_1] 類前綴
        .replace(/^[\w_]+(\s*\([^)]*\))?\s*:\s*/g, '') // 剝掉 AD_1 (AD): 類前綴
        .replace(/["「」]/g, '')
        .trim();
      if (isTopicGen) {
        console.log(`[AI Topic Result]: "${cleanResult}"`);
        console.log('=========================================================\n');
      } else {
        console.log(`[LLM Response]   : "${cleanResult}"`);
        console.log('=========================================================\n');
      }
      return res.json({ status: 'success', text: cleanResult });
    } else {
      console.warn(`[LLM Warning]: API 尚未回傳有效文字或包含錯誤內容。`);
      console.warn(`[Raw Data]   : ${resText.substring(0, 250)}`);
      console.log('=========================================================\n');
    }

    return res.json({ status: 'mock' });
  } catch (err: any) {
    console.error('Server LLM Call Error:', err.message);
    return res.json({ status: 'error', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PixelOffice Backend Server listening on http://localhost:${PORT}`);
});
