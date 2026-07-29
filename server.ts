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
 * POST /api/chat - 由後端伺服器進行 LLM API 呼叫 (包含完整 Console Log)
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { providerId, speakerRole, speakerName, contextMessages, topic } = req.body;
    const config = loadConfig();
    const provider = config.providers?.[providerId];

    if (!provider || providerId === 'mock' || !provider.apiKey) {
      console.log(`[LLM Call] Mode: Mock AI | Speaker: ${speakerName} (${speakerRole})`);
      return res.json({ status: 'mock' });
    }

    const systemPrompt = `你是一名 ${speakerRole}。你現在的名字是 ${speakerName}。請以一到兩句話繁體中文簡短回答，保持極強的人物性格特點。不要輸出前綴。`;
    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      ...(contextMessages || []).slice(-5).map((m: any) => ({
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

    const baseUrl = (provider.baseURL || (provider.sdk === 'ollama' ? 'https://ollama.com' : 'https://api.openai.com/v1')).replace(/\/$/, '');
    const endpoint = provider.sdk === 'ollama' ? `${baseUrl}/api/chat` : `${baseUrl}/chat/completions`;

    // 格式化輸出請求 Log
    console.log('\n=================== 🤖 LLM Request ===================');
    console.log(`[Speaker]  : ${speakerName} (${speakerRole})`);
    console.log(`[Provider] : ${providerId} (${provider.description || providerId})`);
    console.log(`[SDK/Model]: ${provider.sdk} / ${provider.defaultModel}`);
    console.log(`[Endpoint] : ${endpoint}`);
    if (topic) console.log(`[Topic]    : ${topic}`);

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
      console.log(`[LLM Response]: "${text.trim()}"`);
      console.log('=========================================================\n');
      return res.json({ status: 'success', text: text.trim() });
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
