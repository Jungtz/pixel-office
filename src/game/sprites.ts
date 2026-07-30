import { AgentStatus, Direction, RoleType, AgentNeeds } from './types';
import { ROLE_CONFIGS } from '../services/roles';

export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  role: RoleType,
  direction: Direction,
  frame: number,
  x: number,
  y: number,
  size: number,
  status?: AgentStatus
) {
  const config = ROLE_CONFIGS[role];
  ctx.save();
  ctx.translate(x, y);

  const scale = size / 32;
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const isWorkingAnim = status === 'working' && frame % 2 === 1;
  const bounceY = (frame % 2 === 1) ? -1 : 0;
  const legOffset = (frame % 2 === 1) ? 2 : -2;
  const workArmOffset = isWorkingAnim ? 1 : 0;

  ctx.fillStyle = config.clothingColor;
  ctx.fillRect(10, 16 + bounceY, 12, 10);

  if (status === 'working') {
    ctx.fillStyle = config.clothingColor;
    ctx.fillRect(7 + workArmOffset, 17 + bounceY, 3, 2);
    ctx.fillRect(22 - workArmOffset, 17 + bounceY, 3, 2);
    ctx.fillStyle = '#ffdfc4';
    ctx.fillRect(7 + workArmOffset, 19 + bounceY, 2, 2);
    ctx.fillRect(23 - workArmOffset, 19 + bounceY, 2, 2);
  }

  ctx.fillStyle = '#1e293b';
  if (direction === 'left' || direction === 'right') {
    ctx.fillRect(12 + legOffset, 25 + bounceY, 4, 5);
    ctx.fillRect(16 - legOffset, 25 + bounceY, 4, 5);
  } else {
    ctx.fillRect(11, 25 + bounceY, 4, 5);
    ctx.fillRect(17, 25 + bounceY, 4, 5);
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(10, 29, 5, 3);
  ctx.fillRect(17, 29, 5, 3);

  ctx.fillStyle = '#ffdfc4';
  ctx.fillRect(9, 6 + bounceY, 14, 11);

  ctx.fillStyle = config.hairColor;
  ctx.fillRect(8, 4 + bounceY, 16, 5);
  if (direction === 'down') {
    ctx.fillRect(8, 7 + bounceY, 3, 4);
    ctx.fillRect(21, 7 + bounceY, 3, 4);
  } else if (direction === 'left') {
    ctx.fillRect(7, 6 + bounceY, 6, 8);
  } else if (direction === 'right') {
    ctx.fillRect(19, 6 + bounceY, 6, 8);
  } else if (direction === 'up') {
    ctx.fillRect(8, 6 + bounceY, 16, 10);
  }

  if (direction !== 'up') {
    ctx.fillStyle = '#0f172a';
    const eyeY = 10 + bounceY;

    if (direction === 'down') {
      ctx.fillRect(11, eyeY, 2, 3);
      ctx.fillRect(19, eyeY, 2, 3);

      if (role === 'RD') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, eyeY - 1, 4, 4);
        ctx.strokeRect(18, eyeY - 1, 4, 4);
      } else if (role === 'PM') {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(15, 17 + bounceY, 2, 5);
      } else if (role === 'UIUX') {
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(7, 8 + bounceY, 2, 6);
        ctx.fillRect(23, 8 + bounceY, 2, 6);
        ctx.fillRect(9, 4 + bounceY, 14, 2);
      } else if (role === 'QA') {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, eyeY - 1, 4, 4);
        ctx.strokeRect(18, eyeY - 1, 4, 4);
      } else if (role === 'BOSS') {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, eyeY - 1, 4, 4);
        ctx.strokeRect(18, eyeY - 1, 4, 4);
      }
    } else if (direction === 'left') {
      ctx.fillRect(10, eyeY, 2, 3);
    } else if (direction === 'right') {
      ctx.fillRect(20, eyeY, 2, 3);
    }
  }

  if (status === 'coffee') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(21, 15 + bounceY, 6, 7);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(21, 16 + bounceY, 6, 1);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(21, 15 + bounceY, 6, 7);
  }

  if (status === 'phone') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(21, 12 + bounceY, 5, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(22, 13 + bounceY, 3, 3);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(23, 14 + bounceY, 1, 4);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(21, 12 + bounceY, 5, 8);
  }

  if (status === 'stretch') {
    ctx.fillStyle = config.clothingColor;
    ctx.fillRect(7, 7 + bounceY, 3, 6);
    ctx.fillRect(22, 7 + bounceY, 3, 6);
    ctx.fillStyle = '#ffdfc4';
    ctx.fillRect(7, 6 + bounceY, 2, 2);
    ctx.fillRect(23, 6 + bounceY, 2, 2);
  }

  if (status === 'thinking') {
    ctx.fillStyle = config.clothingColor;
    ctx.fillRect(21, 14 + bounceY, 3, 6);
    ctx.fillStyle = '#ffdfc4';
    ctx.fillRect(22, 12 + bounceY, 2, 2);
  }

  if (status === 'patrolling') {
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(21, 14 + bounceY, 4, 6);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(21, 14 + bounceY, 4, 6);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(22, 15 + bounceY, 2, 4);
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 6 + bounceY, 14, 11);

  ctx.restore();
}

export function drawEmojiBubble(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  tileSize: number
) {
  ctx.save();

  const bubbleSize = 18;
  const bx = x + tileSize / 2 - bubbleSize / 2;
  const by = y - bubbleSize - 6;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(bx, by, bubbleSize, bubbleSize);
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bubbleSize, bubbleSize);

  ctx.font = `${bubbleSize - 4}px sans-serif`;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, bx + bubbleSize / 2, by + bubbleSize / 2 + 1);

  ctx.restore();
}

export function drawNeedsBar(
  ctx: CanvasRenderingContext2D,
  needs: AgentNeeds,
  x: number,
  y: number,
  tileSize: number
) {
  ctx.save();

  const barWidth = tileSize + 20;
  const barHeight = 3;
  const gap = 1;
  const totalHeight = barHeight * 3 + gap * 2 + 4;
  const barX = x - 10;
  const barY = y + tileSize + 16;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fillRect(barX, barY, barWidth, totalHeight);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(barX, barY, barWidth, totalHeight);

  const drawBar = (value: number, color: string, offsetY: number) => {
    const fillWidth = Math.max(0, ((barWidth - 4) * value) / 100);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(barX + 2, barY + offsetY, barWidth - 4, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(barX + 2, barY + offsetY, fillWidth, barHeight);
  };

  drawBar(needs.energy, '#ef4444', 2);
  drawBar(needs.caffeine, '#d97706', 2 + barHeight + gap);
  drawBar(needs.social, '#3b82f6', 2 + (barHeight + gap) * 2);

  ctx.restore();
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  size: number,
  now?: Date
) {
  ctx.save();
  ctx.translate(x, y);

  const s2 = 2;
  const s3 = 3;

  if (type === 'floor') {
    const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
    ctx.fillStyle = isEven ? '#1e293b' : '#334155';
    ctx.fillRect(0, 0, size, size);

    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else if (type === 'wall') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(s2, s2, size, size);

    ctx.fillStyle = '#475569';
    ctx.fillRect(1, 1, size - s2, size - s2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(1, 1, size - s2, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(1, size - 1 - 2, size - s2, 2);

    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size / 2);
    ctx.stroke();
  } else if (type === 'desk') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(s3 + 1, s3 + 1, size - 6, size - 6);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(s2, s2, size - 4, size - 4);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, 4, size - 12, 14);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(8, 6, size - 16, 10);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(10, 8, 8, 2);
    ctx.fillRect(10, 11, 12, 2);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(8, 22, size - 16, 6);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s2, s2, size - 4, 2);
  } else if (type === 'meeting_table') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(2, 2, size - 4, size - 4);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(1, 1, size - s2, size - s2);
    ctx.strokeStyle = '#b45309';
    ctx.strokeRect(3, 3, size - 6, size - 6);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, size - s2, 2);
  } else if (type === 'coffee_machine') {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(5, 3, size - 10, size - 6);

    ctx.fillStyle = '#475569';
    ctx.fillRect(4, s2, size - 8, size - 4);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, 4, size - 12, 8);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(8, 6, 3, 3);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(13, 6, 3, 3);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(10, 18, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 20, 6, 8);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, s2, size - 8, 2);
  } else if (type === 'whiteboard') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(3, 5, size - 6, size - 10);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(s2, 4, size - 4, size - 8);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(s2, 4, size - 4, size - 8);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(6, 8, 8, 4);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(18, 8, 8, 4);
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(18, 10);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s2, 4, size - 4, 2);
  } else if (type === 'sofa') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(3, 3, size - 6, size - 6);

    ctx.fillStyle = '#9f1239';
    ctx.fillRect(s2, s2, size - 4, size - 4);
    ctx.fillStyle = '#be123c';
    ctx.fillRect(4, 4, size - 8, size - 8);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s2, s2, size - 4, 2);
  } else if (type === 'boss_desk') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(s2, s2, size - 4, size - 4);

    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(1, 1, size - s2, size - s2);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(3, 3, size - 6, size - 6);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, size - s2, 2);
  } else if (type === 'water_cooler') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(7, 3, size - 14, size - 4);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(8, s2, size - 16, 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 16, size - 12, 16);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, s2, size - 16, 2);
  } else if (type === 'plant') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(4, 23, size - 8, 4);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(4, 22, size - 8, 12);
    ctx.strokeStyle = '#92400e';
    ctx.strokeRect(4, 22, size - 8, 12);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(5, 22, size - 10, 4);

    ctx.fillStyle = '#15803d';
    ctx.fillRect(8, 10, 8, 14);
    ctx.fillRect(16, 8, 8, 14);
    ctx.fillRect(12, 4, 8, 12);

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(10, 8, 4, 6);
    ctx.fillRect(18, 6, 4, 8);

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(14, 4, 4, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(15, 5, 2, 2);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 22, size - 8, 2);
  } else if (type === 'clock') {
    const cx = size / 2;
    const cy = size / 2;
    const r = 13;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, r + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 1.5, cy - r + 3, 3, 3);
    ctx.fillRect(cx + r - 6, cy - 1.5, 3, 3);
    ctx.fillRect(cx - 1.5, cy + r - 6, 3, 3);
    ctx.fillRect(cx - r + 3, cy - 1.5, 3, 3);

    const current = now || new Date();
    const hours = current.getHours();
    const minutes = current.getMinutes();
    const seconds = current.getSeconds();

    const hourAngle = ((hours % 12) * 30 + minutes * 0.5 - 90) * Math.PI / 180;
    const minuteAngle = (minutes * 6 + seconds * 0.1 - 90) * Math.PI / 180;
    const secondAngle = (seconds * 6 - 90) * Math.PI / 180;

    const hourLen = 6;
    const minuteLen = 9;
    const secondLen = 10;

    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hourAngle) * hourLen, cy + Math.sin(hourAngle) * hourLen);
    ctx.stroke();

    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(minuteAngle) * minuteLen, cy + Math.sin(minuteAngle) * minuteLen);
    ctx.stroke();

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(secondAngle) * secondLen, cy + Math.sin(secondAngle) * secondLen);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 2, cy + r + 1, 4, 5);
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(cx, cy + r + 7, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
