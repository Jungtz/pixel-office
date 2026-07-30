import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/gameEngine';
import { AgentCharacter, ChatMessage, TileInfo } from '../game/types';

interface OfficeCanvasProps {
  map: TileInfo[][];
  agents: AgentCharacter[];
  selectedAgentId: string | null;
  activeDialogue: ChatMessage | null;
  onSelectAgent: (agent: AgentCharacter) => void;
}

export const OfficeCanvas: React.FC<OfficeCanvasProps> = ({
  map,
  agents,
  selectedAgentId,
  activeDialogue,
  onSelectAgent
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, map);
    engine.setAgents(agents);
    engine.setSelectedAgent(selectedAgentId);
    engine.setActiveDialogue(activeDialogue);
    engine.setOnAgentClick(onSelectAgent);

    engine.start();
    engineRef.current = engine;

    return () => {
      engine.stop();
    };
  }, [map]);

  // 同步 React state 至 Canvas Engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setAgents(agents);
    }
  }, [agents]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedAgent(selectedAgentId);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setActiveDialogue(activeDialogue);
    }
  }, [activeDialogue]);

  return (
    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        style={{ cursor: 'grab' }}
      />
    </div>
  );
};
