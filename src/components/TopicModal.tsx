import React, { useState, useEffect } from 'react';
import { LLMConfig, generateMockTopic } from '../services/aiAgent';
import { soundManager } from '../services/sound';
import { Sparkles, Dices, ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';

interface TopicModalProps {
  isOpen: boolean;
  llmConfig: LLMConfig;
  onConfirmTopic: (topic: string) => void;
  onBack: () => void;
}

export const TopicModal: React.FC<TopicModalProps> = ({
  isOpen,
  llmConfig,
  onConfirmTopic,
  onBack
}) => {
  const [topic, setTopic] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRolling, setIsRolling] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && !topic) {
      handleRollTopic();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRollTopic = async () => {
    soundManager.playSelectSound();
    setIsRolling(true);
    setIsGenerating(true);

    // 觸發骰子滾動動畫 600ms
    setTimeout(() => {
      setIsRolling(false);
    }, 600);

    console.log(`[Client Topic Generator] Rolling AI Topic via Provider: "${llmConfig.provider}"...`);

    try {
      if (llmConfig.provider !== 'mock') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 125000);

        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerId: llmConfig.provider,
              speakerRole: 'TOPIC',
              speakerName: 'TopicGenerator'
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.text) {
              const cleanText = data.text.replace(/["「」]/g, '').trim();
              console.log(`[Client Topic Generator] Received AI Topic: "${cleanText}"`);
              setTopic(cleanText);
              setIsGenerating(false);
              return;
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      }
    } catch (err) {
      console.warn('[Client Topic Generator Error] AI Topic generation failed, fallback to mock generator:', err);
    }

    // 隨機動態主題產生器
    const mockTopic = generateMockTopic();
    console.log(`[Client Topic Generator] Mock Topic Selected: "${mockTopic}"`);
    setTopic(mockTopic);
    setIsGenerating(false);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    soundManager.playFanfareSound();
    onConfirmTopic(topic.trim());
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="bg-slate-900 border-4 border-amber-400 max-w-2xl w-full p-1 rounded-sm shadow-2xl animate-scale-up"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className="bg-slate-950 border-2 border-amber-500/60 p-6 flex flex-col gap-6 overflow-y-auto"
          style={{ maxHeight: 'calc(92vh - 8px)' }}
        >
          {/* Header */}
          <div className="text-center border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-amber-400 font-mono flex items-center justify-center gap-2 tracking-wider">
              <Sparkles className="w-6 h-6 text-amber-400" />
              本次辦公室冒險主題
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-mono">
              AI 已根據團隊情境生成任務目標，您可以點擊右側骰子 🎲 重新發想或直接修改內文。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* 主題輸入與純圖示骰子按鈕區域 */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded flex flex-col gap-3">
              <label className="text-xs font-mono font-bold text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400" /> 討論主題 / 冒險任務：
                </span>
                <span className="text-[10px] text-slate-500 font-normal font-mono">
                  模式：{llmConfig.provider.toUpperCase()}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="請輸入或生成冒險主題..."
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded px-3 py-2.5 text-sm font-mono text-amber-300 focus:outline-none transition shadow-inner"
                />

                {/* 純圖示骰子按鈕 🎲 (帶 360 度滾動動畫) */}
                <button
                  type="button"
                  onClick={handleRollTopic}
                  disabled={isGenerating || isRolling}
                  className="w-10 h-10 bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded flex items-center justify-center text-slate-950 shadow transition flex-shrink-0 disabled:opacity-50"
                  title="點擊隨機重擲 AI 主題"
                >
                  <Dices className={`w-5 h-5 text-slate-950 ${isRolling ? 'animate-dice-roll' : ''}`} />
                </button>
              </div>

              {isGenerating && (
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 animate-pulse">
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>AI 正在生成冒險主題，請稍候…</span>
                </div>
              )}
            </div>

            {/* Footer Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  soundManager.playSelectSound();
                  onBack();
                }}
                className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> 上一步
              </button>

              <button
                type="submit"
                disabled={!topic.trim() || isGenerating}
                className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold font-mono text-sm rounded border border-amber-500 shadow-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                確認主題，啟動冒險！ <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
