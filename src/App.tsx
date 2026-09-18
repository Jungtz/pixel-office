import React, { useState, useEffect, useRef } from 'react';
import { createDefaultMap, OFFICE_LOCATIONS, isTileWalkable, TILE_SIZE } from './game/officeMap';
import { findPath } from './game/pathfinding';
import { AgentCharacter, ChatMessage, Position, RoleType, MeetingState } from './game/types';
import { fetchLLMResponse, LLMConfig } from './services/aiAgent';
import { getProviderList, getProviderById, getGameLoopConfig } from './services/configService';
import { ROLE_CONFIGS, ROLE_ALIASES } from './services/roles';
import { getTeamLeaderRole, inferTeamFromRoles } from './services/teams';
import { detectStockId } from './services/stockId';
import { RANDOM_EVENT_POOLS } from './services/aiAgent';
import { soundManager } from './services/sound';
import { tickBehavior } from './game/behaviorEngine';
import { triggerRandomEvent, clearPendingChain } from './game/events';
import { generatePersonality } from './game/personality';

import { OfficeCanvas } from './components/OfficeCanvas';
import { ControlPanel } from './components/ControlPanel';
import { DialogueBox } from './components/DialogueBox';
import { SetupModal, RoleSetupConfig, ResumeLlmConfig } from './components/SetupModal';
import { TopicModal } from './components/TopicModal';
import { ChatLog } from './components/ChatLog';
import { ResumeModal } from './components/ResumeModal';
import { backupChatLog, distinctSpeakers, parseStamp, type ResumedSession } from './services/chatLogService';

export const App: React.FC = () => {
  const [map] = useState(() => createDefaultMap());
  const [agents, setAgents] = useState<AgentCharacter[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeDialogue, setActiveDialogue] = useState<ChatMessage | null>(null);
  const [userTurnPending, setUserTurnPending] = useState<AgentCharacter | null>(null);

  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isTopicOpen, setIsTopicOpen] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<RoleSetupConfig | null>(null);
  const [isChatLogOpen, setIsChatLogOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [resumeFromSetup, setResumeFromSetup] = useState(false);
  const [resumeLlm, setResumeLlm] = useState<LLMConfig>({ provider: 'mock' });
  const [historySummary, setHistorySummary] = useState<string>('');
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isActive: false,
    topic: '',
    participants: [],
    log: [],
    startTime: 0
  });

  const [currentTopic, setCurrentTopic] = useState<string>('Q3 核心新功能上線與系統架構優化');

  const [currentTeam, setCurrentTeam] = useState<string>('it');

  const stockIdRef = useRef<string | null>(null);

  /** 開場／主持人：BOSS 優先，否則該團 leader 角色（資訊 PM／財金 CFO／法務 COU） */
  const findLeader = (list: AgentCharacter[], team: string): AgentCharacter | undefined => {
    const leaderRole = getTeamLeaderRole(team);
    return list.find(a => a.role === 'BOSS')
      || (leaderRole ? list.find(a => a.role === leaderRole) : undefined)
      || list[0];
  };

  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'mock'
  });

  const [aiTakeover, setAiTakeover] = useState<boolean>(false);
  const aiTakeoverRef = useRef<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [roundsExhausted, setRoundsExhausted] = useState<boolean>(false);

  const inGameTimeRef = useRef<number>(9);

  useEffect(() => {
    aiTakeoverRef.current = aiTakeover;
  }, [aiTakeover]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const lastDialogueTime = useRef<number>(Date.now());
  const dialogueRoundCount = useRef<number>(0);
  const sessionIdRef = useRef<string>('');
  const sessionStartedAtRef = useRef<string>('');
  // 接續歷史：覆寫同一檔用的檔名（null = 新開 session 照 stamp+主題命名）
  const sessionFileRef = useRef<string | null>(null);
  // 前情提要用 ref 同步一份，避免接續當下閉包拿到舊 state
  const historySummaryRef = useRef<string>('');
  const isGeneratingRef = useRef<boolean>(false);
  const activeDialogueRef = useRef<boolean>(false);
  const userTurnPendingRef = useRef<boolean>(false);
  const [isBusyGenerating, setIsBusyGenerating] = useState<boolean>(false);

  const lastBehaviorTick = useRef<number>(Date.now());
  const lastEventTime = useRef<number>(Date.now());

  useEffect(() => {
    activeDialogueRef.current = activeDialogue !== null;
  }, [activeDialogue]);

  useEffect(() => {
    userTurnPendingRef.current = userTurnPending !== null;
  }, [userTurnPending]);

  // 2b. 對話自動存檔：新訊息後 debounce POST 到後端寫成 chat-logs/*.md
  useEffect(() => {
    if (!sessionIdRef.current || chatMessages.length === 0) return;

    const topic = meetingState.topic || currentTopic;
    const payload = {
      sessionId: sessionIdRef.current,
      topic,
      startedAt: sessionStartedAtRef.current,
      messages: chatMessages.map(m => ({
        timestamp: m.timestamp,
        speakerName: m.speakerName,
        speakerRole: m.speakerRole,
        text: m.text
      })),
      // 接續模式：覆寫同一檔（後端不刪檔）；新開模式則為 undefined 走 stamp+主題命名
      resumeFrom: sessionFileRef.current || undefined,
      historySummary: historySummary || undefined
    };

    const timer = setTimeout(() => {
      fetch('/api/chat-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('[ChatLog Autosave] failed:', err));
    }, 1500);

    return () => clearTimeout(timer);
  }, [chatMessages, currentTopic, meetingState.topic, historySummary]);

  // 1. 第一階段：初始化團隊角色與 Provider，並開啟 TopicModal 選擇主題
  const handleStartSetup = (config: RoleSetupConfig) => {
    setLlmConfig({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      sdk: config.sdk
    });

    setCurrentTeam(config.team || 'it');
    setPendingConfig(config);
    setIsSetupOpen(false);
    setIsTopicOpen(true);
  };

  // 2. 第二階段：確認 Topic 主題，生成 Agents 並啟動冒險
  const handleConfirmTopic = (selectedTopic: string, stockId?: string) => {
    if (!pendingConfig) return;
    setCurrentTopic(selectedTopic);
    stockIdRef.current = stockId || null;

    // 新冒險 = 新 log session（檔名時間戳），清掉接續狀態
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    sessionIdRef.current = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    sessionStartedAtRef.current = now.toLocaleString('zh-TW');
    sessionFileRef.current = null;
    historySummaryRef.current = '';
    setHistorySummary('');

    const newAgents: AgentCharacter[] = [];
    let deskIdx = 0;
    const initTime = Date.now();

    (Object.keys(pendingConfig.counts) as RoleType[]).forEach(role => {
      const count = pendingConfig.counts[role];
      const isUserRole = role === pendingConfig.userRole;
      for (let i = 0; i < count; i++) {
        const deskPos = role === 'BOSS'
          ? OFFICE_LOCATIONS.bossDesk
          : (OFFICE_LOCATIONS.desks[deskIdx % OFFICE_LOCATIONS.desks.length] || { x: 5, y: 5 });

        if (role !== 'BOSS') deskIdx++;

        const isUserAgent = isUserRole && i === 0;
        const agentName = isUserAgent
          ? (pendingConfig.userName || `${role}_${i + 1}`)
          : `${role}_${i + 1}`;
        const personality = generatePersonality(role, newAgents.length);
        newAgents.push({
          id: `${role}_${i}_${Date.now()}`,
          name: agentName,
          role: role,
          gridPos: { ...deskPos },
          targetPos: null,
          pixelPos: { x: deskPos.x * TILE_SIZE, y: deskPos.y * TILE_SIZE },
          direction: 'down',
          animFrame: 0,
          status: 'working',
          path: [],
          speechBubble: null,
          speechTimer: 0,
          deskPos: { ...deskPos },
          isUser: isUserAgent,
          stats: {
            stress: Math.floor(Math.random() * 15 + 10),
            coffeeLevel: Math.floor(Math.random() * 30 + 60),
            workProgress: 0
          },
          needs: {
            energy: Math.floor(Math.random() * 45 + 45),
            caffeine: Math.floor(Math.random() * 50 + 35),
            social: Math.floor(Math.random() * 50 + 25)
          },
          personality,
          mood: 'neutral',
          moodTimer: 0,
          miniBubble: null,
          miniBubbleTimer: 0,
          lastMiniBubbleTime: 0,
          activityStartTime: 0,
          activityDuration: 0,
          emojiBubble: null,
          emojiTimer: 0,
          actionTargetId: null,
          lastRoleActionTime: initTime,
          lastIdleActionTime: initTime,
          eventMoveTarget: null,
          eventMoveStatus: null,
          eventChainId: null,
          eventChainStep: 0
        });
      }
    });

    setAgents(newAgents);
    setIsTopicOpen(false);
    dialogueRoundCount.current = 0;
    setRoundsExhausted(false);
    setIsPaused(false);
    isPausedRef.current = false;
    lastBehaviorTick.current = Date.now();
    lastEventTime.current = Date.now();
    inGameTimeRef.current = 9;
    clearPendingChain();

    // 遊戲啟動宣告開場主題 (由 Boss 或該團主持人進行開場引言)
    setTimeout(() => {
      const leader = findLeader(newAgents, pendingConfig.team || 'it');
      if (leader) {
        triggerAgentSpeech(leader, selectedTopic);
      }
    }, 600);

  };

  // 2c. 接續歷史討論：先備份舊檔，再重建陣容並覆寫同一檔
  const handleOpenResumeFromSetup = (llm: ResumeLlmConfig) => {
    setResumeLlm({ provider: llm.provider, apiKey: llm.apiKey, model: llm.model });
    setResumeFromSetup(true);
    setIsResumeOpen(true);
  };

  const handleOpenResumeInGame = () => {
    setResumeLlm(llmConfig);
    setResumeFromSetup(false);
    setIsResumeOpen(true);
  };

  const handleResumeConfirm = async (session: ResumedSession) => {
    // 1. 先備份舊檔（失敗則中止，不覆寫）
    try {
      await backupChatLog(session.filename);
    } catch (err) {
      console.error('[Resume] 備份舊檔失敗，已中止接續:', err);
      return;
    }

    const llm = resumeFromSetup ? resumeLlm : llmConfig;
    if (resumeFromSetup) {
      setLlmConfig({
        provider: llm.provider,
        apiKey: llm.apiKey,
        model: llm.model
      });
    }

    // 2. 沿用舊檔：sessionId 取檔名 stamp，之後自動存檔直接覆寫同一檔
    const stamp = parseStamp(session.filename);
    if (stamp) sessionIdRef.current = stamp;
    sessionStartedAtRef.current = session.startedAt || new Date().toLocaleString('zh-TW');
    sessionFileRef.current = session.filename;
    historySummaryRef.current = session.summary || '';
    setHistorySummary(session.summary || '');
    setCurrentTopic(session.topic);
    // 接續歷史：從主題自動偵測股票代號（後端無代號時也會自行偵測，此處為前端顯示一致性）
    const resumedStock = detectStockId(session.topic);
    stockIdRef.current = resumedStock;

    // 3. 依歷史發言者重建陣容（接續後全員由 AI 驅動），並依角色推斷團隊
    const speakers = distinctSpeakers(session.messages);
    setCurrentTeam(inferTeamFromRoles(speakers.map(s => s.role)));
    const now = Date.now();
    let deskIdx = 0;
    const newAgents: AgentCharacter[] = speakers.map((s, idx) => {
      const deskPos = s.role === 'BOSS'
        ? OFFICE_LOCATIONS.bossDesk
        : (OFFICE_LOCATIONS.desks[deskIdx % OFFICE_LOCATIONS.desks.length] || { x: 5, y: 5 });
      if (s.role !== 'BOSS') deskIdx++;
      return {
        id: `${s.role}_${idx}_${now}`,
        name: s.name,
        role: s.role,
        gridPos: { ...deskPos },
        targetPos: null,
        pixelPos: { x: deskPos.x * TILE_SIZE, y: deskPos.y * TILE_SIZE },
        direction: 'down',
        animFrame: 0,
        status: 'working',
        path: [],
        speechBubble: null,
        speechTimer: 0,
        deskPos: { ...deskPos },
        isUser: false,
        stats: {
          stress: Math.floor(Math.random() * 15 + 10),
          coffeeLevel: Math.floor(Math.random() * 30 + 60),
          workProgress: 0
        },
        needs: {
          energy: Math.floor(Math.random() * 45 + 45),
          caffeine: Math.floor(Math.random() * 50 + 35),
          social: Math.floor(Math.random() * 50 + 25)
        },
        personality: generatePersonality(s.role, idx),
        mood: 'neutral',
        moodTimer: 0,
        miniBubble: null,
        miniBubbleTimer: 0,
        lastMiniBubbleTime: 0,
        activityStartTime: 0,
        activityDuration: 0,
        emojiBubble: null,
        emojiTimer: 0,
        actionTargetId: null,
        lastRoleActionTime: now,
        lastIdleActionTime: now,
        eventMoveTarget: null,
        eventMoveStatus: null,
        eventChainId: null,
        eventChainStep: 0
      };
    });

    // 4. 歷史訊息灌回（speakerId 映射到新陣容 id）
    const idByName = new Map(newAgents.map(a => [a.name, a.id]));
    const restored: ChatMessage[] = session.messages.map((m, i) => ({
      id: `resume_${now}_${i}`,
      speakerId: idByName.get(m.speakerName) ?? `unknown_${i}`,
      speakerName: m.speakerName,
      speakerRole: m.speakerRole,
      text: m.text,
      timestamp: m.timestamp,
      isMeeting: false
    }));

    setAgents(newAgents);
    setChatMessages(restored);
    setActiveDialogue(null);
    activeDialogueRef.current = false;
    setUserTurnPending(null);
    userTurnPendingRef.current = false;
    setMeetingState({ isActive: false, topic: '', participants: [], log: [], startTime: 0 });
    dialogueRoundCount.current = 0;
    setRoundsExhausted(false);
    setIsPaused(false);
    isPausedRef.current = false;
    lastBehaviorTick.current = Date.now();
    lastEventTime.current = Date.now();
    inGameTimeRef.current = 9;
    clearPendingChain();

    setIsResumeOpen(false);
    setIsSetupOpen(false);
    setIsTopicOpen(false);

    // 5. 自動接續：隨機一位成員基於歷史＋摘要接話
    const snapshot = restored;
    const topic = session.topic;
    setTimeout(() => {
      const cands = newAgents.filter(a => !a.isUser);
      const speaker = cands[Math.floor(Math.random() * cands.length)] || newAgents[0];
      if (speaker) {
        triggerAgentSpeech(speaker, topic, snapshot, newAgents, llm);
      }
    }, 800);
  };

  // 3. 自動漫遊與對話循環 (Agent Autonomous Loop)
  useEffect(() => {
    if (isSetupOpen || isTopicOpen || agents.length === 0) return;

    const loopConfig = getGameLoopConfig();

    const interval = setInterval(async () => {
      const now = Date.now();

      // 暫停中：凍結一切自主行為（手動下一步／插話不受影響）
      if (isPausedRef.current) {
        lastBehaviorTick.current = now;
        return;
      }

      // 如果正在開會，交由會議邏輯驅動
      if (meetingState.isActive) return;

      const deltaSeconds = Math.min((now - lastBehaviorTick.current) / 1000, 10);
      lastBehaviorTick.current = now;

      // 時間模擬：以遊戲心跳推進（每秒約加速 90 秒，即 90x 速度）
      inGameTimeRef.current += (deltaSeconds * 90) / 3600;
      if (inGameTimeRef.current >= 24) inGameTimeRef.current -= 24;
      const timeOfDay = inGameTimeRef.current;

      // 建立 agents 的可變動副本（深拷貝 needs 與 stats 避免直接 mutation）
      const updatedAgents = agents.map(a => ({
        ...a,
        needs: { ...a.needs },
        stats: { ...a.stats }
      }));

      let anyBehaviorChange = false;

      // 需求驅動行為引擎：逐個 agent tick
      for (const agent of updatedAgents) {
        if (agent.path.length > 0) continue;

        const decision = tickBehavior(agent, updatedAgents, deltaSeconds, timeOfDay);
        if (!decision) continue;

        if (decision.action === 'move' && decision.targetPos) {
          const path = findPath(map, agent.gridPos, decision.targetPos);
          if (path.length > 0) {
            agent.path = path;
          }
        }

        agent.status = decision.status;
        if (decision.activityDuration) {
          agent.activityDuration = decision.activityDuration;
          agent.activityStartTime = now;
        }
        if (decision.emojiBubble) {
          agent.emojiBubble = decision.emojiBubble;
          agent.emojiTimer = 3;
        }
        if (decision.actionTargetId) {
          agent.actionTargetId = decision.actionTargetId;
        }

        anyBehaviorChange = true;
      }

      // 隨機事件系統
      if (now - lastEventTime.current > 30000 + Math.random() * 30000) {
        const event = triggerRandomEvent(updatedAgents);
        if (event) {
          lastEventTime.current = now;
          anyBehaviorChange = true;
        }
      }

      if (anyBehaviorChange) {
        setAgents(updatedAgents);
      }

      // 自動觸發對話 (帶入當前辦公室主題與 config.json 設定)
      const { minIntervalMs, chance } = loopConfig.dialogueTrigger;
      const maxReached = loopConfig.maxDialogueRounds && loopConfig.maxDialogueRounds > 0 && dialogueRoundCount.current >= loopConfig.maxDialogueRounds;

      if (
        now - lastDialogueTime.current > minIntervalMs &&
        Math.random() < chance &&
        !isGeneratingRef.current &&
        !activeDialogueRef.current &&
        !userTurnPendingRef.current &&
        !maxReached
      ) {
        lastDialogueTime.current = now;
        const nonUserAgents = updatedAgents.filter(a => !a.isUser);
        if (nonUserAgents.length === 0) return;
        const speaker = nonUserAgents[Math.floor(Math.random() * nonUserAgents.length)];
        triggerAgentSpeech(speaker, currentTopic);
      } else if (maxReached && !activeDialogueRef.current && !userTurnPendingRef.current && !isGeneratingRef.current) {
        setRoundsExhausted(true);
      }
    }, loopConfig.heartbeatIntervalMs);

    return () => clearInterval(interval);
  }, [agents, isSetupOpen, isTopicOpen, meetingState, map, currentTopic]);

  // 更新特定 Agent 的尋路路徑
  const updateAgentPath = (agentId: string, path: Position[], status: AgentCharacter['status']) => {
    setAgents(prev =>
      prev.map(a => (a.id === agentId ? { ...a, path, status } : a))
    );
  };

  const buildSceneData = (topic?: string, agentsOverride?: AgentCharacter[]) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const list = agentsOverride ?? agents;
    const totalPeople = list.length;
    const loopCfg = getGameLoopConfig();
    const maxRounds = loopCfg.maxDialogueRounds || 0;
    const remaining = maxRounds > 0 ? Math.max(0, maxRounds - dialogueRoundCount.current) : -1;

    const isNear = (a: Position, b: Position) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 2;

    const getLocationNote = (agent: AgentCharacter): string => {
      const pos = agent.gridPos;
      const desk = agent.deskPos;
      if (isNear(pos, desk)) return '';

      if (agent.path.length > 0) {
        const dest = agent.path[agent.path.length - 1];
        if (agent.status === 'coffee') return '（正去泡咖啡）';
        if (isNear(dest, OFFICE_LOCATIONS.waterCooler)) return '（正去茶水間）';
        if (isNear(dest, OFFICE_LOCATIONS.whiteboard)) return '（正往白板）';
        if (isNear(dest, desk)) return '（返回座位中）';
        for (const s of OFFICE_LOCATIONS.sofaArea) {
          if (isNear(dest, s)) return '（前往沙發區）';
        }
        return '（走動中）';
      }

      if (agent.status === 'coffee') return '（正在泡咖啡）';
      if (agent.status === 'resting') return '（在沙發區休息）';
      if (agent.status === 'talking') return '（正在和同事聊天）';
      if (isNear(pos, OFFICE_LOCATIONS.coffeeMachine)) return '（在咖啡機前）';
      if (isNear(pos, OFFICE_LOCATIONS.waterCooler)) return '（在飲水機旁）';
      if (isNear(pos, OFFICE_LOCATIONS.whiteboard)) return '（在白板前）';
      for (const s of OFFICE_LOCATIONS.sofaArea) {
        if (isNear(pos, s)) return '（在沙發區休息）';
      }
      return '（走動中）';
    };

    const members = list.map(a => {
      const roleCfg = ROLE_CONFIGS[a.role];
      const userMark = a.isUser ? ' 👤' : '';
      const note = getLocationNote(a);
      return `- [${a.role}] ${a.name}：${roleCfg?.title || a.role}${userMark}${note}`;
    }).join('\n');

    return { time: timeStr, totalPeople, members, topic, roundNumber: dialogueRoundCount.current + 1, maxRounds, remaining };
  };

  const triggerAgentSpeech = async (
    speaker: AgentCharacter,
    topic?: string,
    contextOverride?: ChatMessage[],
    agentsOverride?: AgentCharacter[],
    llmOverride?: LLMConfig
  ) => {
    if (isGeneratingRef.current) return;
    if (speaker.isUser && !aiTakeoverRef.current) {
      setUserTurnPending(speaker);
      userTurnPendingRef.current = true;
      return;
    }
    isGeneratingRef.current = true;
    setIsBusyGenerating(true);

    try {
      const text = await fetchLLMResponse(
        llmOverride ?? llmConfig,
        speaker.role,
        speaker.name,
        contextOverride ?? chatMessages,
        topic,
        buildSceneData(topic, agentsOverride),
        historySummaryRef.current || undefined,
        stockIdRef.current || undefined
      );
      dialogueRoundCount.current++;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        speakerId: speaker.id,
        speakerName: speaker.name,
        speakerRole: speaker.role,
        text,
        timestamp: timeStr,
        isMeeting: meetingState.isActive
      };

      setAgents(prev =>
        prev.map(a =>
          a.id === speaker.id
            ? { ...a, speechBubble: text, speechTimer: 4, direction: 'down' }
            : a
        )
      );

      setChatMessages(prev => [...prev, newMsg]);
      setActiveDialogue(newMsg);
      activeDialogueRef.current = true;

      soundManager.playTextBleep(600);
    } finally {
      isGeneratingRef.current = false;
      setIsBusyGenerating(false);
    }
  };

  const applyDialogueAction = (speakerId: string, text: string) => {
    const nominee = parseNomination(text);
    if (!nominee || nominee.id === speakerId) return;

    const agent = agents.find(a => a.id === nominee.id);
    if (!agent || agent.path.length > 0) return;

    let targetPos: Position | null = null;
    let moveStatus: AgentCharacter['status'] = 'walking';

    if (/咖啡|提神|來一杯/.test(text)) {
      targetPos = OFFICE_LOCATIONS.coffeeMachine;
      moveStatus = 'coffee';
    } else if (/回.*(?:來|去|座位|位子|崗位|工作)/.test(text) || /快回來/.test(text)) {
      targetPos = agent.deskPos;
    } else if (/休息|沙發|坐一下/.test(text)) {
      targetPos = OFFICE_LOCATIONS.sofaArea[0];
    } else if (/喝水|茶水|飲水機|倒杯水/.test(text)) {
      targetPos = OFFICE_LOCATIONS.waterCooler;
    } else if (/白板|討論/.test(text)) {
      targetPos = OFFICE_LOCATIONS.whiteboard;
    }

    if (!targetPos) return;

    const dist = Math.abs(agent.gridPos.x - targetPos.x) + Math.abs(agent.gridPos.y - targetPos.y);
    if (dist <= 1) return;

    const path = findPath(map, agent.gridPos, targetPos);
    if (path.length > 0) {
      updateAgentPath(nominee.id, path, moveStatus);
    }
  };

  const advanceConversation = (speakerId: string, speakerText: string, contextOverride?: ChatMessage[]) => {
    const loopCfg = getGameLoopConfig();
    const maxRounds = loopCfg.maxDialogueRounds ?? 0;
    if (maxRounds > 0 && dialogueRoundCount.current >= maxRounds) {
      setRoundsExhausted(true);
      return;
    }

    // 根據對話中的點名指令，觸發角色實際移動
    applyDialogueAction(speakerId, speakerText);

    const topic = meetingState.topic || currentTopic;
    lastDialogueTime.current = Date.now();

    const nominee = parseNomination(speakerText);
    if (nominee && nominee.id !== speakerId) {
      if (nominee.isUser) {
        if (aiTakeoverRef.current) {
          triggerAgentSpeech(nominee, topic, contextOverride);
          return;
        }
        setActiveDialogue(null);
        activeDialogueRef.current = false;
        setUserTurnPending(nominee);
        userTurnPendingRef.current = true;
        return;
      }
      triggerAgentSpeech(nominee, topic, contextOverride);
      return;
    }

    const nextSpeaker = findNextSpeaker(speakerId, topic);
    if (nextSpeaker) {
      if (nextSpeaker.isUser) {
        setActiveDialogue(null);
        activeDialogueRef.current = false;
        setUserTurnPending(nextSpeaker);
        userTurnPendingRef.current = true;
        return;
      }
      triggerAgentSpeech(nextSpeaker, topic, contextOverride);
    }
  };

  const handleUserReply = (text: string) => {
    if (!userTurnPending) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      speakerId: userTurnPending.id,
      speakerName: userTurnPending.name,
      speakerRole: userTurnPending.role,
      text: trimmed,
      timestamp: timeStr,
      isMeeting: meetingState.isActive
    };

    setAgents(prev =>
      prev.map(a =>
        a.id === userTurnPending.id
          ? { ...a, speechBubble: trimmed, speechTimer: 4, direction: 'down' }
          : a
      )
    );

    setChatMessages(prev => [...prev, newMsg]);
    setUserTurnPending(null);
    userTurnPendingRef.current = false;
    soundManager.playTextBleep(600);

    advanceConversation(userTurnPending.id, trimmed, [...chatMessages, newMsg]);
  };

  // 7b. 隨時插話：以指定 agent 身份發言，再交棒給 AI 接話
  const handleInterject = (speakerId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const agent = agents.find(a => a.id === speakerId);
    if (!agent) return;

    // 若插話者正好有待回應的使用者回合，先清掉避免狀態打架
    if (userTurnPending && userTurnPending.id === speakerId) {
      setUserTurnPending(null);
      userTurnPendingRef.current = false;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      speakerId: agent.id,
      speakerName: agent.name,
      speakerRole: agent.role,
      text: trimmed,
      timestamp: timeStr,
      isMeeting: meetingState.isActive
    };

    setAgents(prev =>
      prev.map(a =>
        a.id === agent.id
          ? { ...a, speechBubble: trimmed, speechTimer: 4, direction: 'down' }
          : a
      )
    );

    setChatMessages(prev => [...prev, newMsg]);
    setActiveDialogue(newMsg);
    activeDialogueRef.current = true;
    soundManager.playTextBleep(600);

    // AI 空閒時直接接話（帶上剛送出的插話，避開閉包舊陣列）
    // 若 AI 正在生成則只貼出訊息，由使用者按下一步推進
    if (!isGeneratingRef.current) {
      advanceConversation(agent.id, trimmed, [...chatMessages, newMsg]);
    }
  };

  // 4. 召開全體會議 (Call Meeting)
  const handleCallMeeting = async (topic: string) => {
    soundManager.playFanfareSound();
    setCurrentTopic(topic);

    // 將所有成員集結至會議室座位
    const updatedAgents = agents.map((agent, idx) => {
      const meetingSeat = OFFICE_LOCATIONS.meetingArea[idx % OFFICE_LOCATIONS.meetingArea.length];
      const path = findPath(map, agent.gridPos, meetingSeat);
      return {
        ...agent,
        path,
        status: 'meeting' as const
      };
    });

    setAgents(updatedAgents);
    setMeetingState({
      isActive: true,
      topic,
      participants: agents.map(a => a.id),
      log: [],
      startTime: Date.now()
    });

    // 發起會議初始發言
    setTimeout(async () => {
      const host = findLeader(agents, currentTeam);
      if (host) {
        await triggerAgentSpeech(host, topic);
      }
    }, 1500);
  };

  // 5. 派發需求/任務 (Dispatch Task)
  const handleDispatchTask = async (task: string) => {
    soundManager.playFanfareSound();
    setCurrentTopic(task);
    const host = findLeader(agents, currentTeam);
    if (host) {
      await triggerAgentSpeech(host, task);
    }
  };


  // 6. 隨機爆發事件 (Random Incident)
  const handleTriggerRandomEvent = () => {
    const pool = RANDOM_EVENT_POOLS[currentTeam] || RANDOM_EVENT_POOLS.it;
    const eventTopic = pool[Math.floor(Math.random() * pool.length)];
    handleDispatchTask(eventTopic);
  };

  // 7. 解析 AI 回覆中的點名 @Role 或 @Name（使用者扮演角色優先匹配）
  const parseNomination = (text: string): AgentCharacter | null => {
    const roleAliases: Record<string, string> = ROLE_ALIASES;
    const match = text.match(/@(\S+?)(?:\s|$|[,，。.、!！?？]|$)/);
    if (!match) return null;

    const rawToken = match[1];
    const upperToken = rawToken.toUpperCase();

    const pickUserFirst = (candidates: AgentCharacter[]) => {
      const userAgents = candidates.filter(a => a.isUser);
      if (userAgents.length > 0) {
        return userAgents[Math.floor(Math.random() * userAgents.length)];
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    };

    const mappedRole = roleAliases[upperToken];
    if (mappedRole) {
      const candidates = agents.filter(a => a.role === mappedRole);
      if (candidates.length > 0) return pickUserFirst(candidates);
    }

    const rolePrefix = upperToken.match(/^([A-Z]+)/);
    if (rolePrefix) {
      const extracted = roleAliases[rolePrefix[1]];
      if (extracted) {
        const candidates = agents.filter(a => a.role === extracted);
        if (candidates.length > 0) return pickUserFirst(candidates);
      }
    }

    const byName = agents.find(a =>
      a.name === rawToken || a.name.toUpperCase() === upperToken
    );
    if (byName) return byName;

    return null;
  };

  // 8. 舉手機制：根據主題關鍵詞 + 最近發言紀錄計算各角色發言優先級
  const findNextSpeaker = (currentSpeakerId: string, topic: string): AgentCharacter | null => {
    const otherAgents = agents.filter(a => a.id !== currentSpeakerId && !a.isUser);
    if (otherAgents.length === 0) return null;

    const recentSpeakerIds = chatMessages.slice(-3).map(m => m.speakerId);
    const topicLower = topic.toLowerCase();

    // 收尾階段：優先由該團主持人（BOSS／PM／CFO／COU）收斂，避免結論發散
    const loopCfg = getGameLoopConfig();
    const maxRounds = loopCfg.maxDialogueRounds ?? 0;
    const remaining = maxRounds > 0 ? maxRounds - dialogueRoundCount.current : -1;
    if (remaining > 0 && remaining <= 2) {
      const leaderRole = getTeamLeaderRole(currentTeam);
      const host = otherAgents.find(a =>
        (a.role === 'BOSS' || (leaderRole && a.role === leaderRole)) && !recentSpeakerIds.includes(a.id)
      );
      if (host) return host;
    }

    const scored = otherAgents.map(agent => {
      let score = 0;

      if (!recentSpeakerIds.includes(agent.id)) {
        score += 3;
      }

      const roleCfg = ROLE_CONFIGS[agent.role];
      for (const kw of roleCfg.interests) {
        if (topicLower.includes(kw.toLowerCase())) {
          score += 2;
          break;
        }
      }

      score += Math.random() * 2;

      return { agent, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (scored[0].score > 2) {
      return scored[0].agent;
    }

    return otherAgents[Math.floor(Math.random() * otherAgents.length)];
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col font-sans select-none">
      
      {/* 頂部與邊緣控制面板 */}
      <ControlPanel
        onCallMeeting={handleCallMeeting}
        onDispatchTask={handleDispatchTask}
        onTriggerRandomEvent={handleTriggerRandomEvent}
        onToggleChatLog={() => setIsChatLogOpen(prev => !prev)}
        onLoadHistory={handleOpenResumeInGame}
        onInterject={handleInterject}
        interjectSpeakers={agents.map(a => ({ id: a.id, name: a.name, role: a.role, isUser: a.isUser === true }))}
        canInterject={agents.length > 0 && !userTurnPending && !isBusyGenerating && !roundsExhausted}
        isPaused={isPaused}
        onTogglePause={() => {
          const newState = !isPaused;
          setIsPaused(newState);
          isPausedRef.current = newState;
        }}
        onResetSetup={() => {
              setActiveDialogue(null);
              activeDialogueRef.current = false;
              setUserTurnPending(null);
              userTurnPendingRef.current = false;
              setIsPaused(false);
              isPausedRef.current = false;
              setIsChatLogOpen(false);
              setIsResumeOpen(false);
              setChatMessages([]);
              sessionFileRef.current = null;
              historySummaryRef.current = '';
              setHistorySummary('');
              stockIdRef.current = null;
              if (meetingState.isActive) {
                setMeetingState({ isActive: false, topic: '', participants: [], log: [], startTime: 0 });
              }
              dialogueRoundCount.current = 0;
              setRoundsExhausted(false);
              setIsSetupOpen(true);
            }}
        isMeetingActive={meetingState.isActive}
        agentCount={agents.length}
        chatMessagesCount={chatMessages.length}
      />

      {/* 2D Canvas 遊戲主畫面 */}
      <div
        className="flex-1 w-full relative"
        style={{
          paddingBottom: (activeDialogue || userTurnPending) ? '195px' : '0',
          transition: 'padding-bottom 0.25s ease'
        }}
      >
        <OfficeCanvas
          map={map}
          agents={agents}
          selectedAgentId={selectedAgentId}
          activeDialogue={activeDialogue}
          onSelectAgent={agent => setSelectedAgentId(agent.id)}
        />
      </div>

      {/* 勇者鬥惡龍 經典打字機對話框 */}
      <DialogueBox
        message={activeDialogue}
        userTurn={userTurnPending}
        onUserReply={handleUserReply}
        isBusy={isBusyGenerating}
        aiTakeover={aiTakeover}
        isPaused={isPaused}
        onToggleAiTakeover={() => {
          const newState = !aiTakeover;
          setAiTakeover(newState);
          aiTakeoverRef.current = newState;
          if (newState && userTurnPending) {
            const pending = userTurnPending;
            setUserTurnPending(null);
            userTurnPendingRef.current = false;
            triggerAgentSpeech(pending, meetingState.topic || currentTopic);
          }
        }}
        autoAdvanceMs={
          activeDialogue
            ? parseNomination(activeDialogue.text)?.isUser
              ? (aiTakeover ? 1500 : undefined)
              : getGameLoopConfig().autoAdvanceMs
            : undefined
        }
        nextLabel={
          activeDialogue
            ? (() => {
                const mention = parseNomination(activeDialogue.text);
                if (!mention || !mention.isUser) return undefined;
                return aiTakeover ? 'AI 自動回覆' : '換你回覆';
              })()
            : undefined
        }
        onNext={() => {
          if (!activeDialogue) return;
          advanceConversation(activeDialogue.speakerId, activeDialogue.text);
        }}
        onClose={() => {
          setActiveDialogue(null);
          activeDialogueRef.current = false;
          setUserTurnPending(null);
          userTurnPendingRef.current = false;
        }}
      />

      {roundsExhausted && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 80,
            pointerEvents: 'auto'
          }}
          className="flex flex-col items-center gap-3 px-6 py-4 bg-slate-900 border-2 border-amber-400 rounded shadow-2xl"
        >
          <p className="text-amber-400 font-mono font-bold text-sm">
            對話已達設定上限（{getGameLoopConfig().maxDialogueRounds} 輪）
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRoundsExhausted(false);
                dialogueRoundCount.current = 0;
              }}
              className="px-4 py-1.5 text-xs font-mono font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded transition"
            >
              重置計數，繼續對話
            </button>
            <button
              onClick={() => {
                setRoundsExhausted(false);
                setIsSetupOpen(true);
              }}
              className="px-4 py-1.5 text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
            >
              重新開始
            </button>
          </div>
        </div>
      )}

      {aiTakeover && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            zIndex: 70,
            pointerEvents: 'auto'
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400 border-2 border-yellow-300 rounded text-xs font-mono font-bold text-black shadow-lg shadow-yellow-400/30"
        >
          <span className="inline-block w-2 h-2 bg-black rounded-full animate-pulse" />
          AI 接管中
          <button
            onClick={() => setAiTakeover(false)}
            className="ml-1 px-2 py-0.5 bg-black text-yellow-400 rounded text-[10px] hover:bg-slate-800 transition"
          >
            切回手動
          </button>
        </div>
      )}

      {/* 側邊歷史紀錄抽屜 */}
      <ChatLog
        isOpen={isChatLogOpen}
        onClose={() => setIsChatLogOpen(false)}
        messages={chatMessages}
        onClear={() => setChatMessages([])}
        onLoadHistory={handleOpenResumeInGame}
      />

      {/* 第一階段：初始化團隊/角色彈窗 */}
      <SetupModal
        isOpen={isSetupOpen}
        onStart={handleStartSetup}
        onOpenResume={handleOpenResumeFromSetup}
      />

      {/* 第二階段：AI 生成與骰子 🎲 重新發想主題彈窗 */}
      <TopicModal
        isOpen={isTopicOpen}
        llmConfig={llmConfig}
        team={currentTeam}
        onConfirmTopic={handleConfirmTopic}
        onBack={() => {
          setIsTopicOpen(false);
          setIsSetupOpen(true);
        }}
      />

      {/* 接續歷史討論：SetupModal 與遊戲畫面共用 */}
      <ResumeModal
        isOpen={isResumeOpen}
        llmConfig={resumeFromSetup ? resumeLlm : llmConfig}
        inGame={!isSetupOpen}
        onClose={() => setIsResumeOpen(false)}
        onConfirm={handleResumeConfirm}
      />


    </div>
  );
};

export default App;
