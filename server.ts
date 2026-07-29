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
 * POST /api/chat - 由後端伺服器進行 LLM API 呼叫 (支援角色發言與 🎲 AI 主題自動發想)
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { providerId, speakerRole, speakerName, contextMessages, topic } = req.body;
    const config = loadConfig();
    const provider = config.providers?.[providerId];

    const isTopicGen = speakerRole === 'TOPIC' || speakerName === 'TopicGenerator';

    if (!provider || providerId === 'mock' || !provider.apiKey) {
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
      systemPrompt = `${basePrompt} 你現在的名字是 ${speakerName}。請以一到兩句話繁體中文簡短回答，保持極強的人物性格特點。不要輸出前綴。`;
      messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...(contextMessages || []).slice(-5).map((m: any) => ({
          role: m.speakerRole === speakerRole ? 'assistant' : 'user',
          content: `${m.speakerName} (${m.speakerRole}): ${m.text}`
        }))
      ];

      if (topic) {
        messagesPayload.push({
          role: 'user',
          content: `當前辦公室討論主題是：「${topic}」。請完全以你專屬的職位視角與性格，針對該主題發表你原創的一兩句話看法（絕不要複製或重複他人發言與標題文字）。若認為某個職位的人特別適合接續回應，可在結尾加上 @PM、@RD、@QA 等點名。`
        });
      }

    }

    const baseUrl = (provider.baseURL || (provider.sdk === 'ollama' ? 'https://ollama.com' : 'https://api.openai.com/v1')).replace(/\/$/, '');
    const endpoint = provider.sdk === 'ollama' ? `${baseUrl}/api/chat` : `${baseUrl}/chat/completions`;

    // 格式化 Console Log 輸出
    if (isTopicGen) {
      console.log('\n=================== 🎲 AI Topic Generation ===================');
      console.log(`[Provider] : ${providerId} (${provider.description || providerId})`);
      console.log(`[SDK/Model]: ${provider.sdk} / ${provider.defaultModel}`);
      console.log(`[Endpoint] : ${endpoint}`);
    } else {
      console.log('\n=================== 🤖 LLM Request ===================');
      console.log(`[Speaker]  : ${speakerName} (${speakerRole})`);
      console.log(`[Prompt MD]: src/prompts/${speakerRole.toLowerCase()}.md`);
      console.log(`[Provider] : ${providerId} (${provider.description || providerId})`);
      console.log(`[SDK/Model]: ${provider.sdk} / ${provider.defaultModel}`);
      console.log(`[Endpoint] : ${endpoint}`);
      if (topic) console.log(`[Topic]    : ${topic}`);
    }

    let response: any;
    if (provider.sdk === 'ollama') {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.defaultModel || 'gemma4:31b-cloud',
          messages: messagesPayload,
          stream: false
        })
      });
    } else {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.defaultModel || 'gpt-3.5-turbo',
          messages: messagesPayload,
          max_tokens: 150,
          temperature: 0.8
        })
      });
    }

    console.log(`[HTTP Status]: ${response.status} ${response.statusText}`);

    const resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch (e) {}

    const text = data.message?.content || data.choices?.[0]?.message?.content;
    if (text && typeof text === 'string') {
      const cleanResult = text.replace(/["「」]/g, '').trim();
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
  console.log(`🚀 AI Roundtable Backend Server listening on http://localhost:${PORT}`);
});
