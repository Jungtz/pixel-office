import * as THREE from 'three';
import { AgentStatus, Direction } from './types';

export interface CharacterRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  body: THREE.Mesh;
  head: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
}

function mat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
}

function part(
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function isValidColor(c: string | undefined, fallback: string): string {
  if (!c || typeof c !== 'string') return fallback;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim()) ? c : fallback;
}

export function createCharacterRig(
  role: string,
  clothingColor?: string,
  hairColor?: string,
): CharacterRig {
  const g = new THREE.Group();
  const clothing = isValidColor(clothingColor, '#0d9488');
  const hair = isValidColor(hairColor, '#134e4a');
  const skin = '#ffdfc4';

  const leftLeg = part(0.16, 0.32, 0.18, '#1e293b', -0.11, 0.16, 0);
  const rightLeg = part(0.16, 0.32, 0.18, '#1e293b', 0.11, 0.16, 0);
  const body = part(0.46, 0.5, 0.3, clothing, 0, 0.57, 0);
  const armL = part(0.12, 0.42, 0.14, clothing, -0.3, 0.57, 0);
  const armR = part(0.12, 0.42, 0.14, clothing, 0.3, 0.57, 0);
  const head = part(0.4, 0.38, 0.36, skin, 0, 1.01, 0);
  const hairTop = part(0.44, 0.14, 0.4, hair, 0, 1.24, 0);
  const hairBack = part(0.44, 0.3, 0.1, hair, 0, 1.1, -0.16);

  g.add(leftLeg, rightLeg, body, armL, armR, head, hairTop, hairBack);

  const eyeMat = mat('#0f172a');
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.02), eyeMat);
  eyeL.position.set(-0.09, 1.02, 0.19);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  g.add(eyeL, eyeR);

  if (role === 'RD' || role === 'QA' || role === 'BOSS') {
    const frameColor = role === 'BOSS' ? '#eab308' : role === 'RD' ? '#38bdf8' : '#f59e0b';
    const gl = part(0.14, 0.14, 0.02, frameColor, -0.09, 1.02, 0.2);
    const gr = part(0.14, 0.14, 0.02, frameColor, 0.09, 1.02, 0.2);
    g.add(gl, gr);
  }
  if (role === 'PM') {
    g.add(part(0.08, 0.3, 0.02, '#ef4444', 0, 0.55, 0.16));
  }
  if (role === 'UIUX') {
    g.add(part(0.06, 0.2, 0.3, '#a855f7', -0.24, 1.05, 0));
    g.add(part(0.06, 0.2, 0.3, '#a855f7', 0.24, 1.05, 0));
  }
  if (role === 'BOSS') {
    g.add(part(0.3, 0.1, 0.28, '#eab308', 0, 1.36, 0));
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  g.add(shadow);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.7, 0.9),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.85;
  hit.name = '__hitbox__';
  g.add(hit);

  return { group: g, leftLeg, rightLeg, body, head, armL, armR };
}

export function updateCharacterPose(
  rig: CharacterRig,
  direction: Direction,
  animFrame: number,
  status: AgentStatus,
  time: number,
): void {
  const walking = status === 'walking' || status === 'patrolling';
  const bounce = animFrame % 2 === 1 ? 0.04 : 0;
  rig.group.position.y = bounce;
  if (walking) {
    const swing = Math.sin(time * 10) * 0.45;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.armL.rotation.x = -swing * 0.7;
    rig.armR.rotation.x = swing * 0.7;
  } else if (status === 'working') {
    const t = Math.sin(time * 6) * 0.15;
    rig.armL.rotation.x = -0.9 + t;
    rig.armR.rotation.x = -0.9 - t;
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
  } else {
    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0;
    rig.armL.rotation.x = 0;
    rig.armR.rotation.x = status === 'stretch' ? -2.6 : 0;
  }

  let rotY = 0;
  if (direction === 'up') rotY = Math.PI;
  else if (direction === 'left') rotY = -Math.PI / 2;
  else if (direction === 'right') rotY = Math.PI / 2;
  rig.group.rotation.y = rotY;
}

export function makeLabelSprite(text: string, opts?: { bg?: string; fg?: string; fontSize?: number }): THREE.Sprite {
  const fontSize = opts?.fontSize ?? 42;
  const bg = opts?.bg ?? 'rgba(15,23,42,0.85)';
  const fg = opts?.fg ?? '#f8fafc';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px "Noto Sans TC", sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  canvas.width = Math.max(2, w);
  canvas.height = fontSize + 36;
  const c2 = canvas.getContext('2d')!;
  c2.fillStyle = bg;
  c2.fillRect(0, 0, canvas.width, canvas.height);
  c2.font = `bold ${fontSize}px "Noto Sans TC", sans-serif`;
  c2.fillStyle = fg;
  c2.textAlign = 'center';
  c2.textBaseline = 'middle';
  c2.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(canvas.width / 220, canvas.height / 220, 1);
  return sprite;
}
