import * as THREE from 'three';
import { TileInfo } from './types';
import { MAP_WIDTH, MAP_HEIGHT } from './officeMap';

export const WORLD_UNIT = 1;
export const WALL_HEIGHT = 1.2;

export function gridToWorld(gx: number, gy: number): { x: number; z: number } {
  return {
    x: gx - MAP_WIDTH / 2 + 0.5,
    z: gy - MAP_HEIGHT / 2 + 0.5,
  };
}

function box(
  w: number,
  h: number,
  d: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildDesk(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9, 0.45, 0.7, '#78350f', 0, 0.225, 0));
  g.add(box(0.9, 0.06, 0.7, '#a16207', 0, 0.48, 0));
  g.add(box(0.5, 0.32, 0.05, '#0f172a', 0, 0.75, -0.18));
  g.add(box(0.44, 0.26, 0.02, '#0284c7', 0, 0.75, -0.15));
  g.add(box(0.5, 0.04, 0.2, '#cbd5e1', 0, 0.53, 0.15));
  return g;
}

function buildMeetingTable(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.95, 0.4, 0.95, '#92400e', 0, 0.2, 0));
  g.add(box(1.0, 0.07, 1.0, '#b45309', 0, 0.44, 0));
  return g;
}

function buildCoffeeMachine(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.7, 0.8, 0.6, '#475569', 0, 0.4, 0));
  g.add(box(0.4, 0.15, 0.05, '#0f172a', 0, 0.62, 0.28));
  g.add(box(0.08, 0.08, 0.06, '#ef4444', -0.1, 0.62, 0.3));
  g.add(box(0.08, 0.08, 0.06, '#22c55e', 0.1, 0.62, 0.3));
  g.add(box(0.18, 0.22, 0.18, '#ffffff', 0, 0.28, 0.15));
  return g;
}

function buildWaterCooler(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.45, 0.6, 0.45, '#e2e8f0', 0, 0.3, 0));
  g.add(box(0.4, 0.3, 0.4, '#0284c7', 0, 0.75, 0));
  return g;
}

function buildWhiteboard(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.95, 0.7, 0.08, '#f8fafc', 0, 0.85, 0));
  g.add(box(0.2, 0.12, 0.02, '#ef4444', -0.2, 0.9, 0.05));
  g.add(box(0.2, 0.12, 0.02, '#3b82f6', 0.2, 0.9, 0.05));
  g.add(box(1.0, 0.06, 0.12, '#64748b', 0, 0.48, 0));
  return g;
}

function buildSofa(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.95, 0.3, 0.8, '#9f1239', 0, 0.15, 0));
  g.add(box(0.95, 0.45, 0.18, '#9f1239', 0, 0.4, -0.32));
  g.add(box(0.85, 0.12, 0.7, '#be123c', 0, 0.36, 0.02));
  return g;
}

function buildBossDesk(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.95, 0.5, 0.8, '#ca8a04', 0, 0.25, 0));
  g.add(box(0.85, 0.08, 0.7, '#1e1b4b', 0, 0.54, 0));
  g.add(box(0.3, 0.25, 0.05, '#0f172a', 0, 0.7, -0.2));
  return g;
}

function buildPlant(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.4, 0.35, 0.4, '#78350f', 0, 0.175, 0));
  g.add(box(0.3, 0.4, 0.3, '#15803d', 0, 0.55, 0));
  g.add(box(0.2, 0.3, 0.2, '#22c55e', 0.1, 0.7, 0.05));
  g.add(box(0.12, 0.12, 0.12, '#fbbf24', 0, 0.85, 0));
  return g;
}

function buildClock(): THREE.Group {
  const g = new THREE.Group();
  // 時鐘格也要有牆體，否則牆面會破一個洞、錶盤浮在黑背景上
  g.add(box(1, WALL_HEIGHT, 1, '#475569', 0, WALL_HEIGHT / 2, 0));
  g.add(box(1.02, 0.08, 1.02, '#0f172a', 0, WALL_HEIGHT + 0.04, 0));

  const faceY = 0.72;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.7 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, faceY, 0.5);
  rim.castShadow = true;
  g.add(rim);

  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.08, 24),
    new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.6 }),
  );
  face.rotation.x = Math.PI / 2;
  face.position.set(0, faceY, 0.54);
  face.castShadow = true;
  g.add(face);

  // 12 刻度
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = box(0.035, i % 3 === 0 ? 0.09 : 0.05, 0.015, '#451a03');
    tick.position.set(Math.sin(a) * 0.24, faceY + Math.cos(a) * 0.24, 0.585);
    tick.rotation.z = -a;
    tick.castShadow = false;
    g.add(tick);
  }

  // 指針（依建造當下時間，方向與 2D 版一致）
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourA = (((hours % 12) + minutes / 60) / 12) * Math.PI * 2;
  const minuteA = ((minutes + seconds / 60) / 60) * Math.PI * 2;
  const secondA = (seconds / 60) * Math.PI * 2;
  const hand = (len: number, w: number, color: string, angle: number, z: number): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(w, len, 0.015);
    geo.translate(0, len / 2 - 0.03, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
    m.position.set(0, faceY, z);
    m.rotation.z = -angle;
    return m;
  };
  g.add(hand(0.14, 0.045, '#1c1917', hourA, 0.59));
  g.add(hand(0.21, 0.032, '#44403c', minuteA, 0.6));
  g.add(hand(0.23, 0.014, '#dc2626', secondA, 0.61));

  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#dc2626' }),
  );
  pin.position.set(0, faceY, 0.61);
  g.add(pin);
  return g;
}

function buildWall(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1, WALL_HEIGHT, 1, '#475569', 0, WALL_HEIGHT / 2, 0));
  g.add(box(1.02, 0.08, 1.02, '#0f172a', 0, WALL_HEIGHT + 0.04, 0));
  return g;
}

export function buildTileObject(type: string): THREE.Group | null {
  switch (type) {
    case 'wall':
      return buildWall();
    case 'desk':
      return buildDesk();
    case 'meeting_table':
      return buildMeetingTable();
    case 'coffee_machine':
      return buildCoffeeMachine();
    case 'water_cooler':
      return buildWaterCooler();
    case 'whiteboard':
      return buildWhiteboard();
    case 'sofa':
      return buildSofa();
    case 'boss_desk':
      return buildBossDesk();
    case 'plant':
      return buildPlant();
    case 'clock':
      return buildClock();
    default:
      return null;
  }
}

export function buildOfficeGroup(map: TileInfo[][]): THREE.Group {
  const root = new THREE.Group();

  const floorGeo = new THREE.BoxGeometry(1, 0.1, 1);
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const floor = new THREE.InstancedMesh(floorGeo, floorMat, MAP_WIDTH * MAP_HEIGHT);
  floor.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const cA = new THREE.Color('#1e293b');
  const cB = new THREE.Color('#2b3a55');
  let idx = 0;
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const w = gridToWorld(x, y);
      dummy.position.set(w.x, -0.05, w.z);
      dummy.updateMatrix();
      floor.setMatrixAt(idx, dummy.matrix);
      floor.setColorAt(idx, (x + y) % 2 === 0 ? cA : cB);
      idx++;
    }
  }
  floor.instanceMatrix.needsUpdate = true;
  if (floor.instanceColor) floor.instanceColor.needsUpdate = true;
  root.add(floor);

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const tile = map[y][x];
      if (tile.type === 'floor') continue;
      const obj = buildTileObject(tile.type);
      if (!obj) continue;
      const w = gridToWorld(x, y);
      obj.position.set(w.x, 0, w.z);
      root.add(obj);
    }
  }

  const grid = new THREE.GridHelper(
    Math.max(MAP_WIDTH, MAP_HEIGHT),
    Math.max(MAP_WIDTH, MAP_HEIGHT),
    0x334155,
    0x1e293b,
  );
  grid.position.y = 0.005;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.25;
  root.add(grid);

  return root;
}
