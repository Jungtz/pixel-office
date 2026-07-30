import { AgentCharacter, ChatMessage, TileInfo, Position } from './types';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from './officeMap';
import { drawCharacterSprite, drawTile, drawEmojiBubble, drawNeedsBar } from './sprites';
import { getCriticalNeedsEmoji } from './behaviorEngine';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: TileInfo[][];
  private agents: AgentCharacter[] = [];
  private selectedAgentId: string | null = null;
  private activeDialogue: ChatMessage | null = null;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private onAgentClickCb?: (agent: AgentCharacter) => void;
  private eavesdropTimers: Map<string, number> = new Map();

  constructor(canvas: HTMLCanvasElement, map: TileInfo[][]) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.map = map;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  public setAgents(agents: AgentCharacter[]) {
    this.agents = agents;
  }

  public setSelectedAgent(id: string | null) {
    this.selectedAgentId = id;
  }

  public setActiveDialogue(dialogue: ChatMessage | null) {
    this.activeDialogue = dialogue;
  }

  public setOnAgentClick(cb: (agent: AgentCharacter) => void) {
    this.onAgentClickCb = cb;
  }

  private resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }

  public start() {
    this.lastTime = performance.now();
    const loop = (timestamp: number) => {
      const dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * 遊戲狀態更新 (位置插值與尋路移動)
   */
  private update(dt: number) {
    const speed = 4; // Grid speed (tiles per second)

    this.agents.forEach(agent => {
      // 倒數頭頂發言泡泡顯示時間
      if (agent.speechTimer > 0) {
        agent.speechTimer -= dt;
        if (agent.speechTimer <= 0) {
          agent.speechBubble = null;
        }
      }

      // 倒數 Emoji 泡泡顯示時間
      if (agent.emojiTimer > 0) {
        agent.emojiTimer -= dt;
        if (agent.emojiTimer <= 0) {
          agent.emojiBubble = null;
        }
      }

      // 倒數迷你對話泡泡顯示時間
      if (agent.miniBubbleTimer > 0) {
        agent.miniBubbleTimer -= dt;
        if (agent.miniBubbleTimer <= 0) {
          agent.miniBubble = null;
        }
      }

      // 如果有路徑，持續移動
      if (agent.path.length > 0) {
        const eavesdropUntil = this.eavesdropTimers.get(agent.id);
        if (eavesdropUntil && Date.now() < eavesdropUntil) {
          agent.animFrame = 0;
        } else {
          this.eavesdropTimers.delete(agent.id);

          agent.status = 'walking';
        const nextGridPos = agent.path[0];
        const targetPixelX = nextGridPos.x * TILE_SIZE;
        const targetPixelY = nextGridPos.y * TILE_SIZE;

        const dx = targetPixelX - agent.pixelPos.x;
        const dy = targetPixelY - agent.pixelPos.y;
        const dist = Math.hypot(dx, dy);

        // 更新朝向
        if (Math.abs(dx) > Math.abs(dy)) {
          agent.direction = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 0) {
          agent.direction = dy > 0 ? 'down' : 'up';
        }

        const step = speed * TILE_SIZE * dt;
        if (dist <= step) {
          // 到達當前網格點
          agent.pixelPos.x = targetPixelX;
          agent.pixelPos.y = targetPixelY;
          agent.gridPos = { ...nextGridPos };
          agent.path.shift(); // 移動至下一個節點

          if (agent.path.length === 0) {
            agent.targetPos = null;
          }
        } else {
          // 步進移動
          agent.pixelPos.x += (dx / dist) * step;
          agent.pixelPos.y += (dy / dist) * step;
          // 行走動畫幀交替
          agent.animFrame = Math.floor((performance.now() / 150) % 2);
        }
        }
      } else {
        // 根據狀態決定動畫幀
        if (agent.status === 'working') {
          agent.animFrame = Math.floor((performance.now() / 400) % 2);
        } else if (agent.status === 'resting') {
          agent.animFrame = Math.floor((performance.now() / 800) % 2);
        } else if (agent.status === 'coffee') {
          agent.animFrame = Math.floor((performance.now() / 500) % 2);
        } else if (agent.status === 'phone') {
          agent.animFrame = Math.floor((performance.now() / 600) % 2);
        } else if (agent.status === 'stretch') {
          agent.animFrame = Math.floor((performance.now() / 900) % 2);
        } else if (agent.status === 'daydream') {
          agent.animFrame = Math.floor((performance.now() / 1200) % 2);
        } else if (agent.status === 'thinking') {
          agent.animFrame = Math.floor((performance.now() / 700) % 2);
        } else if (agent.status === 'patrolling') {
          agent.animFrame = Math.floor((performance.now() / 300) % 2);
        } else {
          agent.animFrame = 0;
        }
      }
    });

    // 互動偵測：相鄰角色自動面對面
    this.detectInteractions();
  }

  private detectInteractions() {
    const now = Date.now();

    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i];
        const b = this.agents[j];
        const dist = Math.abs(a.gridPos.x - b.gridPos.x) + Math.abs(a.gridPos.y - b.gridPos.y);

        if (dist === 1 && a.path.length === 0 && b.path.length === 0) {
          if (a.status === 'talking' || b.status === 'talking') {
            if (a.gridPos.x < b.gridPos.x) {
              a.direction = 'right';
              b.direction = 'left';
            } else if (a.gridPos.x > b.gridPos.x) {
              a.direction = 'left';
              b.direction = 'right';
            } else if (a.gridPos.y < b.gridPos.y) {
              a.direction = 'down';
              b.direction = 'up';
            } else {
              a.direction = 'up';
              b.direction = 'down';
            }
          }
        }

        if (dist === 1 && (a.status === 'talking' || b.status === 'talking')) {
          const mover = a.path.length > 0 ? a : (b.path.length > 0 ? b : null);
          if (mover && !this.eavesdropTimers.has(mover.id)) {
            this.eavesdropTimers.set(mover.id, now + 2000);
          }
        }
      }
    }
  }

  /**
   * 繪製遊戲畫面
   */
  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 計算 Center offset
    const totalMapWidth = MAP_WIDTH * TILE_SIZE;
    const totalMapHeight = MAP_HEIGHT * TILE_SIZE;
    const offsetX = Math.max(0, (this.canvas.width - totalMapWidth) / 2);
    const offsetY = Math.max(0, (this.canvas.height - totalMapHeight) / 2);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // 1. 繪製辦公室 Tilemap
    const now = new Date();
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.map[y][x];
        drawTile(ctx, tile.type, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, now);
      }
    }

    // 2. 繪製選擇高亮標記 (Selected Agent Indicator)
    if (this.selectedAgentId) {
      const selected = this.agents.find(a => a.id === this.selectedAgentId);
      if (selected) {
        ctx.strokeStyle = '#eab308'; // 金黃色選取圈
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          selected.pixelPos.x + TILE_SIZE / 2,
          selected.pixelPos.y + TILE_SIZE / 2 + 8,
          TILE_SIZE / 2 + 2,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        // 頭頂黃色光標指示
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(selected.pixelPos.x + TILE_SIZE / 2, selected.pixelPos.y - 12);
        ctx.lineTo(selected.pixelPos.x + TILE_SIZE / 2 - 6, selected.pixelPos.y - 20);
        ctx.lineTo(selected.pixelPos.x + TILE_SIZE / 2 + 6, selected.pixelPos.y - 20);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 3. 繪製角色 (按 Y 軸排序呈現前後遮擋景深)
    const sortedAgents = [...this.agents].sort((a, b) => a.pixelPos.y - b.pixelPos.y);

    sortedAgents.forEach(agent => {
      drawCharacterSprite(
        ctx,
        agent.role,
        agent.direction,
        agent.animFrame,
        agent.pixelPos.x,
        agent.pixelPos.y,
        TILE_SIZE,
        agent.status
      );

      // Emoji 泡泡（狀態表情，在名字上方）
      const criticalEmoji = getCriticalNeedsEmoji(agent.needs);
      const displayEmoji = agent.emojiBubble || criticalEmoji;
      if (displayEmoji && !agent.speechBubble) {
        drawEmojiBubble(ctx, displayEmoji, agent.pixelPos.x, agent.pixelPos.y, TILE_SIZE);
      }

      // 迷你對話泡泡（人物自發短語，在 Emoji 泡泡上方）
      if (agent.miniBubble && !agent.speechBubble) {
        ctx.save();
        ctx.font = '9px "Noto Sans TC", sans-serif';
        const miniText = agent.miniBubble.length > 10 ? agent.miniBubble.substring(0, 9) + '…' : agent.miniBubble;
        const miniMetrics = ctx.measureText(miniText);
        const miniPad = 4;
        const miniW = miniMetrics.width + miniPad * 2;
        const miniH = 15;
        const miniX = agent.pixelPos.x + TILE_SIZE / 2 - miniW / 2;
        const miniY = agent.pixelPos.y - 30;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
        ctx.fillRect(miniX, miniY, miniW, miniH);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(miniX, miniY, miniW, miniH);
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(miniText, miniX + miniW / 2, miniY + miniH / 2);
        ctx.restore();
      }

      // 角色名稱與職稱標籤
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(agent.pixelPos.x - 10, agent.pixelPos.y + TILE_SIZE + 2, TILE_SIZE + 20, 14);
      ctx.font = '10px "Noto Sans TC", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${agent.name} (${agent.role})`,
        agent.pixelPos.x + TILE_SIZE / 2,
        agent.pixelPos.y + TILE_SIZE + 13
      );

      // 情緒小圖標（名字右側）
      if (agent.mood && agent.mood !== 'neutral') {
        const moodEmojis: Record<string, string> = {
          happy: '😊', stressed: '😫', bored: '😑', excited: '🤩',
          nervous: '😰', focused: '💪', lazy: '😴', panicked: '😱', proud: '😎'
        };
        const moodEmoji = moodEmojis[agent.mood] || '';
        if (moodEmoji) {
          ctx.font = '9px sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(
            moodEmoji,
            agent.pixelPos.x + TILE_SIZE / 2 + 16,
            agent.pixelPos.y + TILE_SIZE + 13
          );
        }
      }

      // 需求進度條（選中角色或需求危急時顯示）
      const showNeedsBar = agent.id === this.selectedAgentId ||
        agent.needs.energy < 20 || agent.needs.caffeine < 20 || agent.needs.social < 20;

      if (showNeedsBar && agent.needs) {
        drawNeedsBar(ctx, agent.needs, agent.pixelPos.x, agent.pixelPos.y, TILE_SIZE);
      }

      // 頭頂 Speech Bubble
      if (agent.speechBubble) {
        this.drawSpeechBubble(
          ctx,
          agent.speechBubble,
          agent.pixelPos.x + TILE_SIZE / 2,
          agent.pixelPos.y - 8
        );
      }
    });

    ctx.restore();
  }

  /**
   * 繪製像素氣泡 (Speech Bubble)
   */
  private drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number
  ) {
    ctx.save();
    ctx.font = '12px "Noto Sans TC", sans-serif';

    const displayText = text.length > 14 ? text.substring(0, 13) + '...' : text;
    const metrics = ctx.measureText(displayText);
    const padding = 8;
    const bubbleWidth = metrics.width + padding * 2;
    const bubbleHeight = 24;

    const bx = Math.round(x - bubbleWidth / 2);
    const by = Math.round(y - bubbleHeight);

    // 深藍底藍框（DQ 質感氣泡）
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bubbleWidth, bubbleHeight);

    // 小箭頭
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(x - 4, by + bubbleHeight);
    ctx.lineTo(x + 4, by + bubbleHeight);
    ctx.lineTo(x, by + bubbleHeight + 5);
    ctx.closePath();
    ctx.fill();

    // 文字
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, x, by + bubbleHeight / 2 + 1);

    ctx.restore();
  }


  /**
   * 處理 Canvas 點擊 Event (選取角色)
   */
  public handleClick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const totalMapWidth = MAP_WIDTH * TILE_SIZE;
    const totalMapHeight = MAP_HEIGHT * TILE_SIZE;
    const offsetX = Math.max(0, (this.canvas.width - totalMapWidth) / 2);
    const offsetY = Math.max(0, (this.canvas.height - totalMapHeight) / 2);

    const mapX = clickX - offsetX;
    const mapY = clickY - offsetY;

    // 檢查點擊是否在角色身上
    for (const agent of this.agents) {
      if (
        mapX >= agent.pixelPos.x &&
        mapX <= agent.pixelPos.x + TILE_SIZE &&
        mapY >= agent.pixelPos.y &&
        mapY <= agent.pixelPos.y + TILE_SIZE + 15
      ) {
        this.selectedAgentId = agent.id;
        if (this.onAgentClickCb) {
          this.onAgentClickCb(agent);
        }
        return;
      }
    }
  }
}
