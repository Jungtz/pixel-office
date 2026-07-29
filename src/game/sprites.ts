import { Direction, RoleType } from './types';
import { ROLE_CONFIGS } from '../services/roles';

/**
 * 程式化 2D 像素繪製引擎 (Pixel Art Procedural Renderer)
 * 渲染 DQ 勇者鬥惡龍風格 16x16 / 32x32 像素角色與辦公室 Tile
 */

/**
 * 繪製角色像素 Sprites
 */
export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  role: RoleType,
  direction: Direction,
  frame: number,
  x: number,
  y: number,
  size: number
) {
  const config = ROLE_CONFIGS[role];
  ctx.save();
  ctx.translate(x, y);

  const scale = size / 32; // base size 32x32
  ctx.scale(scale, scale);

  // 影子 (Shadow)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 走路擺腿與微彈跳
  const bounceY = (frame % 2 === 1) ? -1 : 0;
  const legOffset = (frame % 2 === 1) ? 2 : -2;

  // 1. 身體/衣服 (Clothes)
  ctx.fillStyle = config.clothingColor;
  // 軀幹 (Torso)
  ctx.fillRect(10, 16 + bounceY, 12, 10);

  // 2. 褲子/腿 (Legs)
  ctx.fillStyle = '#1e293b'; // 深色牛仔褲/西裝褲
  if (direction === 'left' || direction === 'right') {
    ctx.fillRect(12 + legOffset, 25 + bounceY, 4, 5);
    ctx.fillRect(16 - legOffset, 25 + bounceY, 4, 5);
  } else {
    ctx.fillRect(11, 25 + bounceY, 4, 5);
    ctx.fillRect(17, 25 + bounceY, 4, 5);
  }

  // 3. 鞋子 (Shoes)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(10, 29, 5, 3);
  ctx.fillRect(17, 29, 5, 3);

  // 4. 頭部/皮膚 (Head & Skin)
  ctx.fillStyle = '#ffdfc4'; // 溫暖膚色
  ctx.fillRect(9, 6 + bounceY, 14, 11);

  // 5. 頭髮 (Hair)
  ctx.fillStyle = config.hairColor;
  // 頭頂髮型
  ctx.fillRect(8, 4 + bounceY, 16, 5);
  if (direction === 'down') {
    ctx.fillRect(8, 7 + bounceY, 3, 4);
    ctx.fillRect(21, 7 + bounceY, 3, 4);
  } else if (direction === 'left') {
    ctx.fillRect(7, 6 + bounceY, 6, 8);
  } else if (direction === 'right') {
    ctx.fillRect(19, 6 + bounceY, 6, 8);
  } else if (direction === 'up') {
    ctx.fillRect(8, 6 + bounceY, 16, 10); // 後腦勺
  }

  // 6. 面部細節 (Eyes & Glasses & Accessories)
  if (direction !== 'up') {
    ctx.fillStyle = '#0f172a'; // 眼睛深色
    const eyeY = 10 + bounceY;

    if (direction === 'down') {
      // 雙眼
      ctx.fillRect(11, eyeY, 2, 3);
      ctx.fillRect(19, eyeY, 2, 3);

      // 特殊職業配件 (眼鏡, 耳機, 領帶)
      if (role === 'RD') {
        // RD 帶藍光眼鏡
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, eyeY - 1, 4, 4);
        ctx.strokeRect(18, eyeY - 1, 4, 4);
      } else if (role === 'PM') {
        // PM 紅領帶
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(15, 17 + bounceY, 2, 5);
      } else if (role === 'UIUX') {
        // UI/UX 頭戴耳機
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(7, 8 + bounceY, 2, 6);
        ctx.fillRect(23, 8 + bounceY, 2, 6);
        ctx.fillRect(9, 4 + bounceY, 14, 2);
      } else if (role === 'QA') {
        // QA 放大鏡或眼鏡
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, eyeY - 1, 4, 4);
        ctx.strokeRect(18, eyeY - 1, 4, 4);
      } else if (role === 'BOSS') {
        // 老闆金邊眼鏡
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

  // 7. DQ 風格邊框細節 (Black Outlines for Pixel Retro Crispness)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 6 + bounceY, 14, 11);

  ctx.restore();
}

/**
 * 繪製辦公室 Tilemap 物件
 */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  size: number
) {
  ctx.save();
  ctx.translate(x, y);

  if (type === 'floor') {
    // 復古木地板 / 棋盤格地板
    const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
    ctx.fillStyle = isEven ? '#1e293b' : '#334155'; // Slate dark tiles
    ctx.fillRect(0, 0, size, size);

    // 微弱格線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeRect(0, 0, size, size);
  } 
  else if (type === 'wall') {
    // 牆壁 (DQ 復古磚牆)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#475569';
    ctx.fillRect(1, 1, size - 2, size - 2);

    // 磚頭紋理
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size / 2);
    ctx.stroke();
  }
  else if (type === 'desk') {
    // 辦公桌與電腦螢幕
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, size, size);

    // 木質桌底
    ctx.fillStyle = '#78350f';
    ctx.fillRect(2, 2, size - 4, size - 4);

    // 電腦螢幕
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, 4, size - 12, 14);
    // 螢幕畫面 (藍光 Code)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(8, 6, size - 16, 10);
    // 螢幕代碼點
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(10, 8, 8, 2);
    ctx.fillRect(10, 11, 12, 2);

    // 鍵盤
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(8, 22, size - 16, 6);
  }
  else if (type === 'meeting_table') {
    // 會議桌
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    // 奢華大理石/胡桃木會議桌
    ctx.fillStyle = '#92400e';
    ctx.fillRect(1, 1, size - 2, size - 2);
    ctx.strokeStyle = '#b45309';
    ctx.strokeRect(3, 3, size - 6, size - 6);
  }
  else if (type === 'coffee_machine') {
    // 咖啡機
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#475569';
    ctx.fillRect(4, 2, size - 8, size - 4);
    // 咖啡機面板與螢幕
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, 4, size - 12, 8);
    ctx.fillStyle = '#ef4444'; // 電源燈
    ctx.fillRect(8, 6, 3, 3);
    ctx.fillStyle = '#22c55e'; // 運作燈
    ctx.fillRect(13, 6, 3, 3);

    // 咖啡杯流出口
    ctx.fillStyle = '#78350f';
    ctx.fillRect(10, 18, 8, 8);
    ctx.fillStyle = '#ffffff'; // 咖啡馬克杯
    ctx.fillRect(12, 20, 6, 8);
  }
  else if (type === 'whiteboard') {
    // 白板
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#f8fafc'; // 白板面
    ctx.fillRect(2, 4, size - 4, size - 8);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(2, 4, size - 4, size - 8);

    // 白板上的彩色圖表/流程圖塗鴉
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(6, 8, 8, 4);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(18, 8, 8, 4);
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(18, 10);
    ctx.stroke();
  }
  else if (type === 'sofa') {
    // 沙發休息區
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    // 紅色沙發
    ctx.fillStyle = '#9f1239';
    ctx.fillRect(2, 2, size - 4, size - 4);
    ctx.fillStyle = '#be123c';
    ctx.fillRect(4, 4, size - 8, size - 8);
  }
  else if (type === 'boss_desk') {
    // 老闆黑金桌
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#ca8a04'; // 金邊
    ctx.fillRect(1, 1, size - 2, size - 2);
    ctx.fillStyle = '#1e1b4b'; // 深紫黑大理石
    ctx.fillRect(3, 3, size - 6, size - 6);
  }
  else if (type === 'water_cooler') {
    // 飲水機
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0284c7'; // 藍色水桶
    ctx.fillRect(8, 2, size - 16, 14);
    ctx.fillStyle = '#e2e8f0'; // 機身
    ctx.fillRect(6, 16, size - 12, 16);
  }

  ctx.restore();
}
