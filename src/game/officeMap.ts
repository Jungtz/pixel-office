import { TileInfo, TileType, Position } from './types';

export const MAP_WIDTH = 24;
export const MAP_HEIGHT = 16;
export const TILE_SIZE = 36; // 36px per tile

// 關鍵地點座標定義
export const OFFICE_LOCATIONS = {
  meetingArea: [
    { x: 16, y: 3 }, { x: 17, y: 3 }, { x: 18, y: 3 }, { x: 19, y: 3 },
    { x: 16, y: 5 }, { x: 17, y: 5 }, { x: 18, y: 5 }, { x: 19, y: 5 }
  ],
  coffeeMachine: { x: 2, y: 2 },
  waterCooler: { x: 3, y: 1 },
  whiteboard: { x: 18, y: 1 },
  sofaArea: [{ x: 2, y: 13 }, { x: 3, y: 13 }, { x: 4, y: 13 }],
  bossDesk: { x: 20, y: 12 },
  desks: [
    // RD Desks
    { x: 6, y: 4 }, { x: 8, y: 4 }, { x: 6, y: 6 }, { x: 8, y: 6 },
    // PM & QA Desks
    { x: 11, y: 4 }, { x: 13, y: 4 }, { x: 11, y: 6 }, { x: 13, y: 6 },
    // UI/UX & AD Desks
    { x: 6, y: 10 }, { x: 8, y: 10 }, { x: 11, y: 10 }, { x: 13, y: 10 },
    // Intern Desk
    { x: 16, y: 10 }
  ]
};

// 建立 24 x 16 的 Tile Grid
export function createDefaultMap(): TileInfo[][] {
  const map: TileInfo[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: TileInfo[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let type: TileType = 'floor';
      let walkable = true;
      let label: string | undefined = undefined;
      let interactable: TileInfo['interactable'] = undefined;

      // 1. 邊界牆壁
      if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) {
        type = 'wall';
        walkable = false;
      }

      // 1.5 時鐘 — 置於頂部牆面正中央 (獨立 if 覆寫 wall)
      if (x === 12 && y === 0) {
        type = 'clock';
        walkable = false;
        label = 'Wall Clock';
      }
      // 2. 會議室隔間牆 (x: 14, y: 1~7)
      else if (x === 14 && y >= 1 && y <= 7) {
        if (y !== 4) { // y=4 為會議室門口
          type = 'wall';
          walkable = false;
        }
      }
      // 3. 茶水間咖啡機 (x: 2, y: 1)
      else if (x === 2 && y === 1) {
        type = 'coffee_machine';
        walkable = false;
        label = 'Coffee Machine';
        interactable = 'coffee';
      }
      else if (x === 3 && y === 1) {
        type = 'water_cooler';
        walkable = false;
        label = 'Water Cooler';
      }
      // 4. 白板 (x: 17~19, y: 1)
      else if (x >= 17 && x <= 19 && y === 1) {
        type = 'whiteboard';
        walkable = false;
        label = 'Whiteboard';
      }
      // 5. 會議桌 (x: 16~19, y: 4)
      else if (x >= 16 && x <= 19 && y === 4) {
        type = 'meeting_table';
        walkable = false;
        label = 'Meeting Table';
        interactable = 'meeting';
      }
      // 6. 沙發區 (x: 2~4, y: 13)
      else if (x >= 2 && x <= 4 && y === 13) {
        type = 'sofa';
        walkable = true;
        label = 'Rest Lounge';
        interactable = 'rest';
      }
      // 7. 老闆桌 (x: 21, y: 12)
      else if (x === 21 && y === 12) {
        type = 'boss_desk';
        walkable = false;
        label = 'CEO Desk';
      }
      // 8. 員工辦公桌點位
      else {
        const isDesk = OFFICE_LOCATIONS.desks.some(d => d.x === x && d.y === y);
        if (isDesk) {
          type = 'desk';
          walkable = false;
          label = 'Workstation';
          interactable = 'work';
        }
      }

      row.push({ type, walkable, label, interactable });
    }
    map.push(row);
  }

  return map;
}

/**
 * 檢查 Grid 座標是否在可行走區域內
 */
export function isTileWalkable(map: TileInfo[][], pos: Position): boolean {
  if (pos.x < 0 || pos.x >= MAP_WIDTH || pos.y < 0 || pos.y >= MAP_HEIGHT) {
    return false;
  }
  return map[pos.y][pos.x].walkable;
}
