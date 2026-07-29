import { AgentCharacter, ChatMessage, TileInfo, Position } from './types';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from './officeMap';
import { drawCharacterSprite, drawTile } from './sprites';
import { ROLE_CONFIGS } from '../services/roles';

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

      // 如果有路徑，持續移動
      if (agent.path.length > 0) {
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
            agent.status = 'idle';
            agent.targetPos = null;
          }
        } else {
          // 步進移動
          agent.pixelPos.x += (dx / dist) * step;
          agent.pixelPos.y += (dy / dist) * step;
          // 行走動畫幀交替
          agent.animFrame = Math.floor((performance.now() / 150) % 2);
        }
      } else {
        agent.animFrame = 0;
      }
    });
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
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.map[y][x];
        drawTile(ctx, tile.type, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE);
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
        TILE_SIZE
      );

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

      // 4. 頭頂 Speech Bubble
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

    const maxLineWidth = 160;
    const padding = 8;
    const metrics = ctx.measureText(text.length > 25 ? text.substring(0, 23) + '...' : text);
    const bubbleWidth = Math.min(metrics.width + padding * 2, maxLineWidth);
    const bubbleHeight = 24;

    const bx = x - bubbleWidth / 2;
    const by = y - bubbleHeight;

    // 深藍底金邊（DQ 質感）
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
    const displayText = text.length > 25 ? text.substring(0, 23) + '...' : text;
    ctx.fillText(displayText, x, by + bubbleHeight / 2);

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
