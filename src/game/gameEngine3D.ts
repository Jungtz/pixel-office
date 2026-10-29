import * as THREE from 'three';
import { AgentCharacter, ChatMessage, TileInfo } from './types';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from './officeMap';
import { buildOfficeGroup, gridToWorld } from './worldMap3D';
import { createCharacterRig, updateCharacterPose, makeLabelSprite, CharacterRig } from './characterFactory3D';
import { ROLE_CONFIGS } from '../services/roles';
import { getCriticalNeedsEmoji } from './behaviorEngine';

interface AgentVisual {
  rig: CharacterRig;
  nameSprite: THREE.Sprite;
  emojiSprite: THREE.Sprite | null;
  lastEmoji: string;
  speechSprite: THREE.Sprite | null;
  lastSpeech: string | null;
}

const MIN_RADIUS = 8;
const MAX_RADIUS = 46;

function disposeMaterial(m: THREE.Material): void {
  const withMap = m as THREE.Material & { map?: THREE.Texture | null };
  withMap.map?.dispose();
  m.dispose();
}

export class GameEngine3D {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private map: TileInfo[][];
  private agents: AgentCharacter[] = [];
  private visuals = new Map<string, AgentVisual>();
  private selectedAgentId: string | null = null;
  private onAgentClickCb?: (agent: AgentCharacter) => void;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private eavesdropTimers = new Map<string, number>();

  private target = new THREE.Vector3(0, 0, 0);
  private radius = 24;
  private theta = 0.0;
  private phi = 0.95;
  private selectionRing: THREE.Mesh;
  private selectionArrow: THREE.Mesh;

  private isDragging = false;
  private didDrag = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragButton = 0;
  private pinchDist = 0;

  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();

  private boundLoop: (t: number) => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundResize: () => void;
  private boundContextMenu: (e: Event) => void;
  private activePointers = new Map<number, { x: number; y: number }>();

  constructor(canvas: HTMLCanvasElement, map: TileInfo[][]) {
    this.canvas = canvas;
    this.map = map;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1120');
    this.scene.fog = new THREE.Fog('#0b1120', 40, 90);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    this.updateCamera();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff7ed, 1.6);
    dir.position.set(12, 20, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -20;
    dir.shadow.camera.right = 20;
    dir.shadow.camera.top = 20;
    dir.shadow.camera.bottom = -20;
    this.scene.add(dir);

    const office = buildOfficeGroup(map);
    this.scene.add(office);

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: '#eab308', side: THREE.DoubleSide, transparent: true }),
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.02;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    this.selectionArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.4, 4),
      new THREE.MeshBasicMaterial({ color: '#eab308' }),
    );
    this.selectionArrow.rotation.x = Math.PI;
    this.selectionArrow.visible = false;
    this.scene.add(this.selectionArrow);

    this.boundLoop = this.loop.bind(this);
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.boundResize = this.resize.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.boundTouchEnd);
    canvas.addEventListener('contextmenu', this.boundContextMenu);
    window.addEventListener('resize', this.boundResize);
    this.resize();
  }

  setAgents(agents: AgentCharacter[]): void {
    this.agents = agents;
    this.syncVisuals();
  }

  setSelectedAgent(id: string | null): void {
    this.selectedAgentId = id;
  }

  setActiveDialogue(_d: ChatMessage | null): void {}

  setOnAgentClick(cb: (agent: AgentCharacter) => void): void {
    this.onAgentClickCb = cb;
  }

  start(): void {
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.boundLoop);
  }

  stop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = null;
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    this.canvas.removeEventListener('touchend', this.boundTouchEnd);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    window.removeEventListener('resize', this.boundResize);
    for (const v of this.visuals.values()) {
      this.scene.remove(v.rig.group);
    }
    this.visuals.clear();
    this.scene.traverse((obj) => {
      const anyObj = obj as unknown as {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      anyObj.geometry?.dispose();
      if (Array.isArray(anyObj.material)) {
        anyObj.material.forEach(disposeMaterial);
      } else if (anyObj.material) {
        disposeMaterial(anyObj.material);
      }
    });
    this.renderer.dispose();
  }

  zoomIn(): void {
    this.radius = Math.max(MIN_RADIUS, this.radius - 2.5);
    this.updateCamera();
  }

  zoomOut(): void {
    this.radius = Math.min(MAX_RADIUS, this.radius + 2.5);
    this.updateCamera();
  }

  resetZoom(): void {
    this.target.set(0, 0, 0);
    this.radius = 24;
    this.theta = 0;
    this.phi = 0.95;
    this.updateCamera();
  }

  private updateCamera(): void {
    const p = Math.max(0.25, Math.min(1.35, this.phi));
    this.phi = p;
    this.camera.position.set(
      this.target.x + this.radius * Math.sin(p) * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(p),
      this.target.z + this.radius * Math.sin(p) * Math.cos(this.theta),
    );
    this.camera.lookAt(this.target);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private syncVisuals(): void {
    const alive = new Set(this.agents.map((a) => a.id));
    for (const [id, v] of [...this.visuals]) {
      if (!alive.has(id)) {
        this.scene.remove(v.rig.group);
        this.visuals.delete(id);
      }
    }
    for (const agent of this.agents) {
      if (!this.visuals.has(agent.id)) {
        const cfg = ROLE_CONFIGS[agent.role];
        const rig = createCharacterRig(agent.role, cfg?.clothingColor, cfg?.hairColor);
        const nameSprite = makeLabelSprite(`${agent.name} (${agent.role})`, { fontSize: 36 });
        nameSprite.position.set(0, 1.95, 0);
        rig.group.add(nameSprite);
        const w = this.agentWorld(agent);
        rig.group.position.set(w.x, 0, w.z);
        this.scene.add(rig.group);
        this.visuals.set(agent.id, {
          rig,
          nameSprite,
          emojiSprite: null,
          lastEmoji: '',
          speechSprite: null,
          lastSpeech: null,
        });
      }
    }
  }

  private agentWorld(agent: AgentCharacter): { x: number; z: number } {
    const fx = agent.pixelPos.x / TILE_SIZE;
    const fy = agent.pixelPos.y / TILE_SIZE;
    return gridToWorld(fx, fy);
  }

  private loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    this.update(dt, timestamp / 1000);
    this.renderer.render(this.scene, this.camera);
    this.animFrameId = requestAnimationFrame(this.boundLoop);
  }

  private update(dt: number, time: number): void {
    const speed = 4;
    for (const agent of this.agents) {
      if (agent.speechTimer > 0) {
        agent.speechTimer -= dt;
        if (agent.speechTimer <= 0) agent.speechBubble = null;
      }
      if (agent.emojiTimer > 0) {
        agent.emojiTimer -= dt;
        if (agent.emojiTimer <= 0) agent.emojiBubble = null;
      }
      if (agent.miniBubbleTimer > 0) {
        agent.miniBubbleTimer -= dt;
        if (agent.miniBubbleTimer <= 0) agent.miniBubble = null;
      }
      if (agent.path.length > 0) {
        const until = this.eavesdropTimers.get(agent.id);
        if (until && Date.now() < until) {
          agent.animFrame = 0;
        } else {
          this.eavesdropTimers.delete(agent.id);
          agent.status = 'walking';
          const next = agent.path[0];
          const tx = next.x * TILE_SIZE;
          const ty = next.y * TILE_SIZE;
          const dx = tx - agent.pixelPos.x;
          const dy = ty - agent.pixelPos.y;
          const dist = Math.hypot(dx, dy);
          if (Math.abs(dx) > Math.abs(dy)) agent.direction = dx > 0 ? 'right' : 'left';
          else if (Math.abs(dy) > 0) agent.direction = dy > 0 ? 'down' : 'up';
          const step = speed * TILE_SIZE * dt;
          if (dist <= step) {
            agent.pixelPos.x = tx;
            agent.pixelPos.y = ty;
            agent.gridPos = { ...next };
            agent.path.shift();
            if (agent.path.length === 0) agent.targetPos = null;
          } else {
            agent.pixelPos.x += (dx / dist) * step;
            agent.pixelPos.y += (dy / dist) * step;
            agent.animFrame = Math.floor((performance.now() / 150) % 2);
          }
        }
      } else {
        const rate =
          agent.status === 'working' ? 400
          : agent.status === 'resting' ? 800
          : agent.status === 'patrolling' ? 300
          : 600;
        agent.animFrame = Math.floor((performance.now() / rate) % 2);
      }
    }
    this.detectInteractions();
    this.renderAgents(time);
  }

  private detectInteractions(): void {
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i];
        const b = this.agents[j];
        const dist = Math.abs(a.gridPos.x - b.gridPos.x) + Math.abs(a.gridPos.y - b.gridPos.y);
        if (dist === 1 && (a.status === 'talking' || b.status === 'talking')) {
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
    }
  }

  private renderAgents(time: number): void {
    this.syncVisuals();
    const sorted = [...this.agents].sort((a, b) => {
      const wa = this.agentWorld(a);
      const wb = this.agentWorld(b);
      return wa.z - wb.z;
    });
    sorted.forEach((agent, order) => {
      const v = this.visuals.get(agent.id);
      if (!v) return;
      const w = this.agentWorld(agent);
      v.rig.group.position.x = w.x;
      v.rig.group.position.z = w.z;
      v.rig.group.renderOrder = order;
      updateCharacterPose(v.rig, agent.direction, agent.animFrame, agent.status, time);

      const critical = agent.speechBubble ? '' : getCriticalNeedsEmoji(agent.needs);
      const emoji = agent.speechBubble ? '' : agent.emojiBubble || critical || '';
      if (emoji !== v.lastEmoji) {
        if (v.emojiSprite) {
          v.rig.group.remove(v.emojiSprite);
          disposeMaterial(v.emojiSprite.material);
          v.emojiSprite = null;
        }
        if (emoji) {
          const s = makeLabelSprite(emoji, { bg: 'rgba(15,23,42,0.9)', fontSize: 52 });
          s.position.set(0, 2.45, 0);
          s.scale.set(0.7, 0.7, 1);
          v.rig.group.add(s);
          v.emojiSprite = s;
        }
        v.lastEmoji = emoji;
      }

      const speech = agent.speechBubble
        ? agent.speechBubble.length > 14
          ? agent.speechBubble.substring(0, 13) + '…'
          : agent.speechBubble
        : null;
      if (speech !== v.lastSpeech) {
        if (v.speechSprite) {
          v.rig.group.remove(v.speechSprite);
          disposeMaterial(v.speechSprite.material);
          v.speechSprite = null;
        }
        if (speech) {
          const s = makeLabelSprite(speech, { bg: 'rgba(15,23,42,0.95)', fg: '#f8fafc', fontSize: 38 });
          s.position.set(0, 2.95, 0);
          s.scale.y *= 0.8;
          v.rig.group.add(s);
          v.speechSprite = s;
        }
        v.lastSpeech = speech;
      }
    });

    const selected = this.agents.find((a) => a.id === this.selectedAgentId);
    if (selected) {
      const w = this.agentWorld(selected);
      this.selectionRing.visible = true;
      this.selectionArrow.visible = true;
      this.selectionRing.position.set(w.x, 0.02, w.z);
      this.selectionArrow.position.set(w.x, 2.6 + Math.sin(time * 3) * 0.12, w.z);
    } else {
      this.selectionRing.visible = false;
      this.selectionArrow.visible = false;
    }
  }

  private pickAgent(clientX: number, clientY: number): AgentCharacter | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNDC.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const v of this.visuals.values()) targets.push(v.rig.group);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        for (const [id, v] of this.visuals) {
          if (v.rig.group === o) return this.agents.find((a) => a.id === id) ?? null;
        }
        o = o.parent;
      }
    }
    return null;
  }

  private onPointerDown(e: PointerEvent): void {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.didDrag = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragButton = e.button;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.activePointers.size === 2) {
      const [p1, p2] = [...this.activePointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (this.pinchDist > 0) {
        this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.radius - (d - this.pinchDist) * 0.08));
        this.updateCamera();
      }
      this.pinchDist = d;
      this.didDrag = true;
      return;
    }
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (!this.didDrag && Math.hypot(dx, dy) < 5) return;
    this.didDrag = true;
    if (this.dragButton === 2 || e.shiftKey) {
      const s = this.radius * 0.0016;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 2);
      right.y = 0;
      up.y = 0;
      right.normalize();
      up.normalize();
      this.target.addScaledVector(right, -dx * s).addScaledVector(up, -dy * s);
      this.target.x = Math.max(-MAP_WIDTH / 2, Math.min(MAP_WIDTH / 2, this.target.x));
      this.target.z = Math.max(-MAP_HEIGHT / 2, Math.min(MAP_HEIGHT / 2, this.target.z));
    } else {
      this.theta -= dx * 0.005;
      this.phi -= dy * 0.004;
    }
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.updateCamera();
  }

  private onPointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) this.pinchDist = 0;
    if (this.isDragging && this.activePointers.size === 0) {
      if (!this.didDrag) {
        const agent = this.pickAgent(e.clientX, e.clientY);
        if (agent) {
          this.selectedAgentId = agent.id;
          this.onAgentClickCb?.(agent);
        }
      }
      this.isDragging = false;
      this.didDrag = false;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.radius + (e.deltaY > 0 ? 1.6 : -1.6)));
    this.updateCamera();
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.pinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.cancelable) e.preventDefault();
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0 && this.pinchDist !== 0) this.pinchDist = 0;
  }
}
