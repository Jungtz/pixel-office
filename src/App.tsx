import React, { useState, useEffect, useRef } from 'react';
import { createDefaultMap, OFFICE_LOCATIONS, isTileWalkable, TILE_SIZE } from './game/officeMap';
import { findPath } from './game/pathfinding';
import { AgentCharacter, ChatMessage, Position, RoleType, MeetingState } from './game/types';
import { fetchLLMResponse, LLMConfig } from './services/aiAgent';
import { getProviderList, getProviderById, getGameLoopConfig } from './services/configService';
import { ROLE_CONFIGS } from './services/roles';
import { soundManager } from './services/sound';

import { OfficeCanvas } from './components/OfficeCanvas';
import { ControlPanel } from './components/ControlPanel';
import { DialogueBox } from './components/DialogueBox';
import { SetupModal, RoleSetupConfig } from './components/SetupModal';
import { TopicModal } from './components/TopicModal';
import { ChatLog } from './components/ChatLog';

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
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isActive: false,
    topic: '',
    participants: [],
    log: [],
    startTime: 0
  });

  const [currentTopic, setCurrentTopic] = useState<string>('Q3 核心新功能上線與系統架構優化');

  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'mock'
  });

  const [aiTakeover, setAiTakeover] = useState<boolean>(false);
  const aiTakeoverRef = useRef<boolean>(false);
  const [roundsExhausted, setRoundsExhausted] = useState<boolean>(false);

  useEffect(() => {
    aiTakeoverRef.current = aiTakeover;
  }, [aiTakeover]);

  const lastDialogueTime = useRef<number>(Date.now());
  const dialogueRoundCount = useRef<number>(0);
  const isGeneratingRef = useRef<boolean>(false);
  const activeDialogueRef = useRef<boolean>(false);
  const userTurnPendingRef = useRef<boolean>(false);
  const [isBusyGenerating, setIsBusyGenerating] = useState<boolean>(false);

  useEffect(() => {
    activeDialogueRef.current = activeDialogue !== null;
  }, [activeDialogue]);

  useEffect(() => {
    userTurnPendingRef.current = userTurnPending !== null;
  }, [userTurnPending]);

  // 1. 第一階段：初始化團隊角色與 Provider，並開啟 TopicModal 選擇主題
  const handleStartSetup = (config: RoleSetupConfig) => {
    setLlmConfig({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      sdk: config.sdk
    });

    setPendingConfig(config);
    setIsSetupOpen(false);
    setIsTopicOpen(true);
  };

  // 2. 第二階段：確認 Topic 主題，生成 Agents 並啟動冒險
  const handleConfirmTopic = (selectedTopic: string) => {
    if (!pendingConfig) return;
    setCurrentTopic(selectedTopic);

    const newAgents: AgentCharacter[] = [];
    let deskIdx = 0;

    (Object.keys(pendingConfig.counts) as RoleType[]).forEach(role => {
      const count = pendingConfig.counts[role];
      const isUserRole = role === pendingConfig.userRole;
      for (let i = 0; i < count; i++) {
        const deskPos = OFFICE_LOCATIONS.desks[deskIdx % OFFICE_LOCATIONS.desks.length] || { x: 5, y: 5 };
        deskIdx++;

        const isUserAgent = isUserRole && i === 0;
        const agentName = isUserAgent
          ? (pendingConfig.userName || `${role}_${i + 1}`)
          : `${role}_${i + 1}`;
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
            stress: Math.floor(Math.random() * 40 + 20),
            coffeeLevel: Math.floor(Math.random() * 50 + 50),
            workProgress: 0
          }
        });
      }
    });

    setAgents(newAgents);
    setIsTopicOpen(false);
    dialogueRoundCount.current = 0;
    setRoundsExhausted(false);

    // 遊戲啟動宣告開場主題 (由 Boss 或 PM 進行開場引言)
    setTimeout(() => {
      const leader = newAgents.find(a => a.role === 'BOSS') || newAgents.find(a => a.role === 'PM') || newAgents[0];
      if (leader) {
        triggerAgentSpeech(leader, selectedTopic);
      }
    }, 600);

  };

  // 3. 自動漫遊與對話循環 (Agent Autonomous Loop)
  useEffect(() => {
    if (isSetupOpen || isTopicOpen || agents.length === 0) return;

    const loopConfig = getGameLoopConfig();

    const interval = setInterval(async () => {
      // 如果正在開會，交由會議邏輯驅動
      if (meetingState.isActive) return;

      const now = Date.now();
      // 隨機挑選一個閒置 Agent 進行移動或倒咖啡
      const idleAgents = agents.filter(a => a.path.length === 0);
      if (idleAgents.length === 0) return;

      const randomAgent = idleAgents[Math.floor(Math.random() * idleAgents.length)];

      const { goCoffee, visitColleague } = loopConfig.behaviorWeights;
      const goSofa = 0.15;
      const goWhiteboard = 0.10;
      const goWaterCooler = 0.15;

      const distToDesk = Math.abs(randomAgent.gridPos.x - randomAgent.deskPos.x) +
                         Math.abs(randomAgent.gridPos.y - randomAgent.deskPos.y);

      // 在座位附近 → 大多待著工作，只有 20% 機率起身
      if (distToDesk <= 2 && Math.random() > 0.2) return;

      // 遠離座位 → 65% 機率先回座位
      if (distToDesk > 2 && Math.random() < 0.65) {
        const path = findPath(map, randomAgent.gridPos, randomAgent.deskPos);
        if (path.length > 0) { updateAgentPath(randomAgent.id, path, 'walking'); }
        return;
      }

      const rand = Math.random();

      if (rand < goCoffee) {
        const distToCoffee = Math.abs(randomAgent.gridPos.x - OFFICE_LOCATIONS.coffeeMachine.x) +
                             Math.abs(randomAgent.gridPos.y - OFFICE_LOCATIONS.coffeeMachine.y);
        if (distToCoffee > 2) {
          const path = findPath(map, randomAgent.gridPos, OFFICE_LOCATIONS.coffeeMachine);
          if (path.length > 0) updateAgentPath(randomAgent.id, path, 'coffee');
        }
      } else if (rand < goCoffee + visitColleague) {
        const otherAgents = agents.filter(a => a.id !== randomAgent.id);
        if (otherAgents.length > 0) {
          const colleague = otherAgents[Math.floor(Math.random() * otherAgents.length)];
          const path = findPath(map, randomAgent.gridPos, colleague.gridPos);
          if (path.length > 0) updateAgentPath(randomAgent.id, path, 'walking');
        }
      } else if (rand < goCoffee + visitColleague + goSofa) {
        const spot = OFFICE_LOCATIONS.sofaArea[Math.floor(Math.random() * OFFICE_LOCATIONS.sofaArea.length)];
        const dist = Math.abs(randomAgent.gridPos.x - spot.x) + Math.abs(randomAgent.gridPos.y - spot.y);
        if (dist > 1) {
          const path = findPath(map, randomAgent.gridPos, spot);
          if (path.length > 0) updateAgentPath(randomAgent.id, path, 'walking');
        }
      } else if (rand < goCoffee + visitColleague + goSofa + goWhiteboard) {
        const dist = Math.abs(randomAgent.gridPos.x - OFFICE_LOCATIONS.whiteboard.x) +
                     Math.abs(randomAgent.gridPos.y - OFFICE_LOCATIONS.whiteboard.y);
        if (dist > 1) {
          const path = findPath(map, randomAgent.gridPos, OFFICE_LOCATIONS.whiteboard);
          if (path.length > 0) updateAgentPath(randomAgent.id, path, 'walking');
        }
      } else if (rand < goCoffee + visitColleague + goSofa + goWhiteboard + goWaterCooler) {
        const dist = Math.abs(randomAgent.gridPos.x - OFFICE_LOCATIONS.waterCooler.x) +
                     Math.abs(randomAgent.gridPos.y - OFFICE_LOCATIONS.waterCooler.y);
        if (dist > 1) {
          const path = findPath(map, randomAgent.gridPos, OFFICE_LOCATIONS.waterCooler);
          if (path.length > 0) updateAgentPath(randomAgent.id, path, 'walking');
        }
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
        const nonUserAgents = agents.filter(a => !a.isUser);
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

  const buildSceneData = (topic?: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const totalPeople = agents.length;
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

      if (isNear(pos, OFFICE_LOCATIONS.coffeeMachine)) return '（在咖啡機前）';
      if (isNear(pos, OFFICE_LOCATIONS.waterCooler)) return '（在飲水機旁）';
      if (isNear(pos, OFFICE_LOCATIONS.whiteboard)) return '（在白板前）';
      for (const s of OFFICE_LOCATIONS.sofaArea) {
        if (isNear(pos, s)) return '（在沙發區休息）';
      }
      return '（走動中）';
    };

    const members = agents.map(a => {
      const roleCfg = ROLE_CONFIGS[a.role];
      const userMark = a.isUser ? ' 👤' : '';
      const note = getLocationNote(a);
      return `- [${a.role}] ${a.name}：${roleCfg?.title || a.role}${userMark}${note}`;
    }).join('\n');

    return { time: timeStr, totalPeople, members, topic, roundNumber: dialogueRoundCount.current + 1, maxRounds, remaining };
  };

  const triggerAgentSpeech = async (speaker: AgentCharacter, topic?: string) => {
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
        llmConfig,
        speaker.role,
        speaker.name,
        chatMessages,
        topic,
        buildSceneData(topic)
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

  const advanceConversation = (speakerId: string, speakerText: string) => {
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
          triggerAgentSpeech(nominee, topic);
          return;
        }
        setActiveDialogue(null);
        activeDialogueRef.current = false;
        setUserTurnPending(nominee);
        userTurnPendingRef.current = true;
        return;
      }
      triggerAgentSpeech(nominee, topic);
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
      triggerAgentSpeech(nextSpeaker, topic);
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

    advanceConversation(userTurnPending.id, trimmed);
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
      const pmOrBoss = agents.find(a => a.role === 'PM' || a.role === 'BOSS') || agents[0];
      if (pmOrBoss) {
        await triggerAgentSpeech(pmOrBoss, topic);
      }
    }, 1500);
  };

  // 5. 派發需求/任務 (Dispatch Task)
  const handleDispatchTask = async (task: string) => {
    soundManager.playFanfareSound();
    setCurrentTopic(task);
    const pm = agents.find(a => a.role === 'PM') || agents[0];
    if (pm) {
      await triggerAgentSpeech(pm, task);
    }
  };


  // 6. 隨機爆發事件 (Random Incident)
  const handleTriggerRandomEvent = () => {
    const events = [
      '客戶在體驗測試環境時，發現 Button 連點會畫面白屏！',
      '金流 API 突然回傳 500 錯誤，訂單大量被掛起！',
      '發現某個第三方套件爆出零日漏洞，全體手動緊急 hotfix！'
    ];
    const eventTopic = events[Math.floor(Math.random() * events.length)];
    handleDispatchTask(eventTopic);
  };

  // 7. 解析 AI 回覆中的點名 @Role 或 @Name（使用者扮演角色優先匹配）
  const parseNomination = (text: string): AgentCharacter | null => {
    const roleAliases: Record<string, RoleType> = {
      'PM': 'PM', 'RD': 'RD', 'QA': 'QA', 'UIUX': 'UIUX', 'UI': 'UIUX',
      'AD': 'AD', 'INTERN': 'INTERN', 'BOSS': 'BOSS',
    };
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
        onResetSetup={() => setIsSetupOpen(true)}
        isMeetingActive={meetingState.isActive}
        agentCount={agents.length}
        chatMessagesCount={chatMessages.length}
      />

      {/* 2D Canvas 遊戲主畫面 */}
      <div className="flex-1 w-full h-full relative">
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
      />

      {/* 第一階段：初始化團隊/角色彈窗 */}
      <SetupModal
        isOpen={isSetupOpen}
        onStart={handleStartSetup}
      />

      {/* 第二階段：AI 生成與骰子 🎲 重新發想主題彈窗 */}
      <TopicModal
        isOpen={isTopicOpen}
        llmConfig={llmConfig}
        onConfirmTopic={handleConfirmTopic}
        onBack={() => {
          setIsTopicOpen(false);
          setIsSetupOpen(true);
        }}
      />


    </div>
  );
};

export default App;
