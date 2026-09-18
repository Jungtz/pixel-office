import { ROLE_CONFIGS } from './roles';
import { AgentCharacter, ChatMessage, RoleType } from '../game/types';

export interface LLMConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  sdk?: string;
}

const MOCK_TOPIC_POOLS: Record<string, string[]> = {
  it: [
    'Q3 核心新功能上線與系統架構優化',
    '客戶緊急反饋之系統效能瓶頸處理',
    '重構舊版程式碼與導入 Design System',
    '準備週五 5 點產線正式 Build 發佈',
    '第三方 API 金鑰突發失效之備援處置',
    '全面導入 AI 智慧助理提升研發產能',
    '跨部門溝通效率提升與需求優先級對齊',
    '使用者體驗 (UX) 全面升級與跑版防護'
  ],
  finance: [
    'Q3 財報結算與年度預算重編',
    '金管會金檢缺失之限期改善計畫',
    '股東會前瞻：股利政策與議案攻防',
    '除權息旺季之資金調度與作業排程',
    '新投資案之估值合理性與回收期評估',
    '成本飆升下的費用控管與獲利保衛戰',
    '轉投資事業體之績效檢討與去留決策',
    '現金增資或發債之資金籌措方案評估'
  ],
  legal: [
    '重大合約違約之求償與談判策略',
    '新產品上市前之智財檢索與布局',
    '主管機關裁罰之救濟與改善對策',
    '經銷合約全面換約與條款攻防',
    '營業秘密外洩疑雲之保全與究責',
    '勞資爭議調解案之底線與和解條件',
    '商標被搶註之異議與訴訟評估',
    '董監改選之公司治理與議事攻防'
  ]
};

// 舊版相容：預設資訊團主題池
const MOCK_TOPIC_POOL = MOCK_TOPIC_POOLS.it;

/**
 * 隨機產生辦公室冒險主題
 * @param team 團隊 id（it / finance / legal），未知團隊回退資訊團
 */
export function generateMockTopic(team?: string): string {
  const pool = (team && MOCK_TOPIC_POOLS[team]) || MOCK_TOPIC_POOL;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] || pool[0];
}

/** 各團隨機突發事件池（右上「事件」按鈕用） */
export const RANDOM_EVENT_POOLS: Record<string, string[]> = {
  it: [
    '客戶在體驗測試環境時，發現 Button 連點會畫面白屏！',
    '金流 API 突然回傳 500 錯誤，訂單大量被掛起！',
    '發現某個第三方套件爆出零日漏洞，全體手動緊急 hotfix！'
  ],
  finance: [
    '金管會突襲金檢，點名內控缺失要求兩週內改善！',
    '主要往來銀行突然緊縮額度，下週票款軋不過來！',
    '外資出具報告看空，股價開盤直接摜破季線！'
  ],
  legal: [
    '收到競爭對手寄來的侵權警告函，要求七日內回覆！',
    '經銷商揚言片面解約，還放話要提告求償！',
    '媒體爆料公司涉入勞資糾紛，主管機關要求說明！'
  ]
};

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
  ],
  CFO: [
    '關於「{topic}」，我先看現金流影響數，錢關沒過什麼都別談！',
    '「{topic}」的預算上限我先框出來，超支部分誰來認？',
    '董事會只問一句：「{topic}」多久能看到效益？大家給我答案！'
  ],
  ACC: [
    '「{topic}」相關憑證先備齊，科目掛錯月底我對不平！',
    '關於「{topic}」，稅務上要先確認認列時點，別踩到查稅紅線！',
    '我先把「{topic}」的帳務處理原則寫出來，大家照表報帳！'
  ],
  AUD: [
    '「{topic}」的內控覆核點我先列出來，沒覆核不能放行！',
    '針對「{topic}」，職能分工要先切開，球員兼裁判金檢一定被罰！',
    '我先盤一下「{topic}」的高風險環節，查核軌跡要留好！'
  ],
  ANA: [
    '關於「{topic}」，我跑了三個情境試算，先看數字再決定怎麼做！',
    '「{topic}」的投報率我粗估了一下，回收期比預期長，大家要有心理準備！',
    '同業數據我拉出來了，「{topic}」這樣做CP值到底高不高一看就知道！'
  ],
  STK: [
    '「{topic}」要先確認股東會時程，議事程序來不及就麻煩了！',
    '關於「{topic}」，股東那邊要怎麼說明？我先準備懶人包！',
    '「{topic}」若涉及重大訊息，公告時限我先卡好，不能逾期！'
  ],
  COU: [
    '關於「{topic}」，法律風險我先盤一遍，紅燈區在哪大家先知道！',
    '「{topic}」動之前，我的法律意見書要先出來，不能邊做邊補！',
    '「{topic}」的書面紀錄從今天開始留，到時候各說各話就輸了！'
  ],
  CMP: [
    '「{topic}」要先過法遵審查，程序沒走完不能動！',
    '針對「{topic}」，申報文件我先列清單，一件都不能少！',
    '「{topic}」踩到高風險態樣了，先通報再往下走！'
  ],
  CTR: [
    '「{topic}」相關合約我先全部調出來，條款不對等的先註記！',
    '關於「{topic}」，付款跟驗收要綁死，不然到時候收不到錢！',
    '「{topic}」的保密跟終止條款，我堅持這次一次談到位！'
  ],
  IPR: [
    '「{topic}」動之前先做前案檢索，踩到別人專利就白做了！',
    '關於「{topic}」，該申請的專利商標先卡位，公開就來不及了！',
    '「{topic}」的研發成果，保密跟歸屬條款我先幫大家守住！'
  ],
  LIT: [
    '「{topic}」最壞打起來會怎樣，我先沙盤推演給大家看！',
    '關於「{topic}」，存證跟證據先固定，談判才有籌碼！',
    '「{topic}」能談就不要告，成本差十倍，和解底線我先畫出來！'
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
  ],
  CFO: [
    '「{topic}」燒錢速度太快了！非必要支出全部凍結，先止血！',
    '針對「{topic}」，我立刻調度緊急預備金，董事會那邊我去擋！'
  ],
  ACC: [
    '「{topic}」的帳先凍結，憑證全部封存，數字亂了後面全錯！',
    '關於「{topic}」，我連夜把影響數算出來，明早給董事會交代！'
  ],
  AUD: [
    '「{topic}」啟動緊急查核！相關軌跡全部保全，缺失單先開再說！',
    '針對「{topic}」，舞弊跟疏失的可能性我同步排查，不放過任何環節！'
  ],
  ANA: [
    '「{topic}」的損失試算我拉出來了，最壞情況大家先有底！',
    '關於「{topic}」，我比對了歷史數據，應變方案A跟B的成本差在這！'
  ],
  STK: [
    '「{topic}」若達重訊標準，我立刻發重大訊息，時限不能踩線！',
    '股東電話已經進來了！「{topic}」的說明稿我馬上生出來！'
  ],
  COU: [
    '「{topic}」法律戰開打！時效跟證據我先锁死，一步都不能錯！',
    '針對「{topic}」，我的緊急法律意見兩小時內出來，大家照著做！'
  ],
  CMP: [
    '「{topic}」立刻通報主管機關！隱匿不報罰更重！',
    '相關申報文件我連夜備齊，金檢明天來也不怕！'
  ],
  CTR: [
    '「{topic}」相關合約的違約跟終止條款，我現在逐條翻出來應戰！',
    '對方若拿合約壓我們，「{topic}」的反制條款我已經找到了！'
  ],
  IPR: [
    '「{topic}」的研發資料立刻管制，保密缺口先堵起來！',
    '侵權風險我連夜比對前案，「{topic}」的閃避設計方向有了！'
  ],
  LIT: [
    '「{topic}」存證信函我現在就發，先把時效跟立場釘死！',
    '開戰了！「{topic}」的談判底線跟訴訟劇本，我同步準備兩套！'
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
    const isIncident = /Bug|崩潰|白屏|錯誤|漏洞|瓶頸|500|緊急|Hotfix|金檢|缺失|裁罰|訴訟|侵權|違約|解約|爆雷|股價|緊縮|警告函|糾紛/i.test(cleanTopic);
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
  historySummary?: string,
  stockId?: string
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
          historySummary,
          stockId
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
