import React, { useEffect, useRef } from 'react';
import { GameEngine3D } from '../game/gameEngine3D';
import { AgentCharacter, ChatMessage, TileInfo } from '../game/types';

interface OfficeCanvas3DProps {
  map: TileInfo[][];
  agents: AgentCharacter[];
  selectedAgentId: string | null;
  activeDialogue: ChatMessage | null;
  onSelectAgent: (agent: AgentCharacter) => void;
}

export const OfficeCanvas3D: React.FC<OfficeCanvas3DProps> = ({
  map,
  agents,
  selectedAgentId,
  activeDialogue,
  onSelectAgent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine3D | null>(null);
  const onSelectRef = useRef(onSelectAgent);
  onSelectRef.current = onSelectAgent;

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new GameEngine3D(canvasRef.current, map);
    engine.setAgents(agents);
    engine.setSelectedAgent(selectedAgentId);
    engine.setActiveDialogue(activeDialogue);
    engine.setOnAgentClick((a) => onSelectRef.current(a));
    engine.start();
    engineRef.current = engine;
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    engineRef.current?.setAgents(agents);
  }, [agents]);

  useEffect(() => {
    engineRef.current?.setSelectedAgent(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    engineRef.current?.setActiveDialogue(activeDialogue);
  }, [activeDialogue]);

  return (
    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="block touch-none w-full h-full" style={{ cursor: 'grab' }} />
      <div className="absolute bottom-3 right-3 z-10 flex gap-1.5">
        <button
          onClick={() => engineRef.current?.zoomIn()}
          className="w-8 h-8 bg-slate-900/90 border border-slate-700 rounded text-slate-200 text-lg leading-none hover:border-amber-400"
          title="放大"
        >
          +
        </button>
        <button
          onClick={() => engineRef.current?.zoomOut()}
          className="w-8 h-8 bg-slate-900/90 border border-slate-700 rounded text-slate-200 text-lg leading-none hover:border-amber-400"
          title="縮小"
        >
          −
        </button>
        <button
          onClick={() => engineRef.current?.resetZoom()}
          className="h-8 px-2 bg-slate-900/90 border border-slate-700 rounded text-slate-200 text-xs font-mono hover:border-amber-400"
          title="重置視角"
        >
          重置
        </button>
      </div>
      <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-slate-900/80 border border-slate-700 rounded text-[10px] font-mono text-slate-400 pointer-events-none">
        3D・左鍵旋轉 / 右鍵平移 / 滾輪縮放
      </div>
    </div>
  );
};
