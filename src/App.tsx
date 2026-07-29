import React, { useState, useEffect, useRef } from 'react';
import { createDefaultMap, OFFICE_LOCATIONS, isTileWalkable, TILE_SIZE } from './game/officeMap';
import { findPath } from './game/pathfinding';
import { AgentCharacter, ChatMessage, Position, RoleType, MeetingState } from './game/types';
import { fetchLLMResponse, LLMConfig } from './services/aiAgent';
import { ROLE_CONFIGS } from './services/roles';
import { soundManager } from './services/sound';

import { OfficeCanvas } from './components/OfficeCanvas';
import { ControlPanel } from './components/ControlPanel';
import { DialogueBox } from './components/DialogueBox';
import { SetupModal, RoleSetupConfig } from './components/SetupModal';
import { ChatLog } from './components/ChatLog';

export const App: React.FC = () => {
  const [map] = useState(() => createDefaultMap());
  const [agents, setAgents] = useState<AgentCharacter[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeDialogue, setActiveDialogue] = useState<ChatMessage | null>(null);

  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isChatLogOpen, setIsChatLogOpen] = useState(false);
  const [meetingState, setMeetingState] = useState<MeetingState>({
    isActive: false,
    topic: '',
    participants: [],
    log: [],
    startTime: 0
  });

  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'mock'
  });

  // 避免隨機自動對話過於頻繁的 timer ref
  const lastDialogueTime = useRef<number>(Date.now());

  // 1. 初始化團隊角色
  const handleStartSetup = (config: RoleSetupConfig) => {
    setLlmConfig({
      provider: config.provider,
      apiKey: config.apiKey
    });

    const newAgents: AgentCharacter[] = [];
    let deskIdx = 0;

    (Object.keys(config.counts) as RoleType[]).forEach(role => {
      const count = config.counts[role];
      for (let i = 0; i < count; i++) {
        const deskPos = OFFICE_LOCATIONS.desks[deskIdx % OFFICE_LOCATIONS.desks.length] || { x: 5, y: 5 };
        deskIdx++;

        const agentName = `${role}_${i + 1}`;
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
          stats: {
            stress: Math.floor(Math.random() * 40 + 20),
            coffeeLevel: Math.floor(Math.random() * 50 + 50),
            workProgress: 0
          }
        });
      }
    });

    setAgents(newAgents);
    setIsSetupOpen(false);
  };

  // 2. 自動漫遊與對話循環 (Agent Autonomous Loop)
  useEffect(() => {
    if (isSetupOpen || agents.length === 0) return;

    const interval = setInterval(async () => {
      // 如果正在開會，交由會議邏輯驅動
      if (meetingState.isActive) return;

      const now = Date.now();
      // 隨機挑選一個閒置 Agent 進行移動或倒咖啡
      const idleAgents = agents.filter(a => a.path.length === 0);
      if (idleAgents.length === 0) return;

      const randomAgent = idleAgents[Math.floor(Math.random() * idleAgents.length)];

      // 隨機行為分類：40% 留在座位，30% 去咖啡機，30% 去找同事聊聊
      const rand = Math.random();

      if (rand < 0.3) {
        // 去咖啡機
        const path = findPath(map, randomAgent.gridPos, OFFICE_LOCATIONS.coffeeMachine);
        if (path.length > 0) {
          updateAgentPath(randomAgent.id, path, 'coffee');
        }
      } else if (rand < 0.6) {
        // 去找另一位同事聊聊
        const otherAgents = agents.filter(a => a.id !== randomAgent.id);
        if (otherAgents.length > 0) {
          const colleague = otherAgents[Math.floor(Math.random() * otherAgents.length)];
          const path = findPath(map, randomAgent.gridPos, colleague.gridPos);
          if (path.length > 0) {
            updateAgentPath(randomAgent.id, path, 'walking');
          }
        }
      }

      // 每隔 6 秒以上，發動一次隨機對話
      if (now - lastDialogueTime.current > 6000 && Math.random() > 0.4) {
        lastDialogueTime.current = now;
        const speaker = agents[Math.floor(Math.random() * agents.length)];
        triggerAgentSpeech(speaker);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [agents, isSetupOpen, meetingState, map]);

  // 更新特定 Agent 的尋路路徑
  const updateAgentPath = (agentId: string, path: Position[], status: AgentCharacter['status']) => {
    setAgents(prev =>
      prev.map(a => (a.id === agentId ? { ...a, path, status } : a))
    );
  };

  // 觸發 Agent 發言
  const triggerAgentSpeech = async (speaker: AgentCharacter, topic?: string) => {
    const text = await fetchLLMResponse(llmConfig, speaker.role, speaker.name, chatMessages, topic);
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

    // 更新角色頭頂 Speech Bubble 與對話紀錄
    setAgents(prev =>
      prev.map(a =>
        a.id === speaker.id
          ? { ...a, speechBubble: text, speechTimer: 4, direction: 'down' }
          : a
      )
    );

    setChatMessages(prev => [...prev, newMsg]);
    setActiveDialogue(newMsg);

    // 播放復古打字嗶嗶聲
    soundManager.playTextBleep(600);
  };

  // 3. 召開全體會議 (Call Meeting)
  const handleCallMeeting = async (topic: string) => {
    soundManager.playFanfareSound();

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
        await triggerAgentSpeech(pmOrBoss, `召開會議主題：${topic}`);
      }
    }, 1500);
  };

  // 4. 派發需求/任務 (Dispatch Task)
  const handleDispatchTask = async (task: string) => {
    soundManager.playFanfareSound();
    const pm = agents.find(a => a.role === 'PM') || agents[0];
    if (pm) {
      await triggerAgentSpeech(pm, `緊急任務通知：${task}`);
    }
  };

  // 5. 隨機爆發事件 (Random Incident)
  const handleTriggerRandomEvent = () => {
    const events = [
      '客戶報告正式環境出現重大 Bug！點擊登入提示 500 錯誤！',
      '辦公室咖啡機豆子用完了！大家陷入集體集體集體崩潰！',
      '老闆說今天表現優秀，給團隊點了星巴克與豪華外送餐點！',
      '發現某個第三方套件爆出零日漏洞，全體手動緊急 hotfix！'
    ];
    const eventTopic = events[Math.floor(Math.random() * events.length)];
    handleDispatchTask(eventTopic);
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
        onNext={() => {
          // 隨機讓下一位 Agent 接話
          const otherAgents = agents.filter(a => a.id !== activeDialogue?.speakerId);
          if (otherAgents.length > 0) {
            const nextSpeaker = otherAgents[Math.floor(Math.random() * otherAgents.length)];
            triggerAgentSpeech(nextSpeaker, meetingState.topic || undefined);
          } else {
            setActiveDialogue(null);
          }
        }}
        onClose={() => setActiveDialogue(null)}
      />

      {/* 側邊歷史紀錄抽屜 */}
      <ChatLog
        isOpen={isChatLogOpen}
        onClose={() => setIsChatLogOpen(false)}
        messages={chatMessages}
        onClear={() => setChatMessages([])}
      />

      {/* 初始化/組隊彈窗 */}
      <SetupModal
        isOpen={isSetupOpen}
        onStart={handleStartSetup}
      />

    </div>
  );
};

export default App;
