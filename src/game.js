// 게임 본체: 월드, 캐릭터, 시스템을 묶고 매 프레임 업데이트
import * as THREE from 'three';
import { ISLANDS, REEF, BOAT_START, PLAYER_START, ZONES } from './config.js';
import { heightAt, buildDepthTexture } from './world/terrain.js';
import { Ocean, storm } from './world/ocean.js';
import { Sky } from './world/sky.js';
import { buildWorld, restoreBlight, updateReefFoam } from './world/world.js';
import { Village, PLAZA } from './world/motunui.js';
import { Locations, Manta } from './world/locations.js';
import { Boat, HELM, MAST, BOX, DECK } from './entities/boat.js';
import { Character } from './entities/character.js';
import { Critter } from './entities/critters.js';
import { OceanRescue } from './entities/oceanHand.js';
import { Kakamora } from './entities/kakamora.js';
import { Lalotai } from './entities/lalotai.js';
import { TeKa, TF } from './entities/teka.js';
import { Chapter2, MOTUFETU } from './entities/chapter2.js';
import { Input, emptyCommand } from './systems/input.js';
import { CameraRig } from './systems/camera.js';
import { Effects } from './systems/effects.js';
import { Combat } from './systems/combat.js';
import { Audio } from './systems/audio.js';
import { Quests, LINES, STAGES } from './systems/quests.js';
import { HUD } from './ui/hud.js';
import { Dialog } from './ui/dialog.js';
import { WorldMap } from './ui/map.js';
import { palmGeometry } from './world/props.js';
import { clamp, smoothstep, josa } from './util.js';

const SAVE_KEY = 'moana-voyage-save-v1';

class Emitter {
  constructor() { this.h = {}; }
  on(e, f) { (this.h[e] ||= []).push(f); }
  emit(e, d) { (this.h[e] || []).forEach((f) => f(d)); }
}

export class Game {
  constructor(container) {
    this.container = container;
    this.events = new Emitter();
    this.time = 0;
    this.timeOfDay = 0.3;
    this.zone = 'surface';
    this.flags = {};
    this.inventory = { coconut: 0, banana: 0, taro: 0, fish: 0, breadfruit: 0, meal: 0 };
    this.wind = { yaw: 2.4 };
    this.interactables = [];
    this.climbables = [];
    this.labels = [];
    this.npcs = {};
    this.excludeZones = [
      { x: PLAZA.x, z: PLAZA.z, r: 55 }, { x: 0, z: 30, r: 20 }, { x: -118, z: -5, r: 22 }, { x: 30, z: 225, r: 30 },
      { x: -70, z: 20, r: 22 }, { x: -82, z: 198, r: 12 },
    ];
    this.lines = LINES;
    this.paused = false;
    this.started = false;
    this.stormAmount = 0;
    this.saveTimer = 0;
    this.boatBoost = 1;
  }

  // ---------- 초기화 ----------
  init() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    r.setSize(window.innerWidth, window.innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#bfe6ff', 500, 3200);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 12000);
    window.addEventListener('resize', () => this.resize());

    this.audio = new Audio();
    this.input = new Input(r.domElement);
    this.hud = new HUD(this);
    this.dialog = new Dialog(this);
    this.map = new WorldMap(this);
    this.effects = new Effects(this);
    this.combat = new Combat(this);
    this.quests = new Quests(this);
    this.camRig = new CameraRig(this.camera);

    this.sky = new Sky(this.scene);
    this.depthTex = buildDepthTexture();
    this.ocean = new Ocean(this.depthTex);
    this.scene.add(this.ocean.mesh);
    buildWorld(this);

    this.boat = new Boat(this.scene);
    this.boat.setPose(BOAT_START.x, BOAT_START.z, BOAT_START.yaw);
    this.climbables.push({ kind: 'mast', onBoat: true, a: new THREE.Vector3(MAST.x, 0, MAST.z), b: new THREE.Vector3(MAST.x, MAST.height - 1.2, MAST.z), speed: 3.5, offset: 0.45 });

    this.moana = new Character(this, 'moana');
    this.maui = new Character(this, 'maui');
    this.characters = [this.moana, this.maui];
    this.heihei = new Critter(this, 'heihei');
    this.pua = new Critter(this, 'pua');
    this.critters = [this.heihei, this.pua];
    this.rescue = new OceanRescue(this);

    this.village = new Village(this);
    this.locations = new Locations(this);
    this.manta = new Manta(this);
    this.kakamora = new Kakamora(this);
    this.lalotai = new Lalotai(this);
    this.tamatoa = this.lalotai;
    this.teka = new TeKa(this);
    this.ch2 = new Chapter2(this);

    for (const isl of ISLANDS) {
      if (isl.lavaRing) continue;
      this.label(new THREE.Vector3(isl.x, Math.max(20, heightAt(isl.x, isl.z) + 25), isl.z), isl.name, { big: true, island: isl });
    }

    this.addInteractable({
      pos: new THREE.Vector3(), radius: 6, getPos: () => this.maui.worldPos(),
      label: () => '💬 마우이와 이야기하기',
      enabled: (c) => !this.flags.mauiJoined && c.kind === 'moana',
      action: () => this.talkMaui(),
    });

    this.setupUIButtons();
    this.events.on('boatBump', (e) => {
      this.audio.play('bonk');
      if (e.reef) this.hud.toast('쿵! 암초에 부딪혔어요. 남쪽의 틈으로 나가요!');
    });
    this.events.on('transform', (e) => { if (e.form === 'hawk' && this.quests.is('shapeshift')) this.flags.hawkTried = true; });
    this.events.on('takeHelm', () => {
      if (!this.flags.helmTutorial) { this.flags.helmTutorial = true; this.hud.toast('앞 = 돛 올리기 / 뒤 = 내리기 / 좌우 = 방향. 바람을 등지면 빨라요!'); }
    });
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setupUIButtons() {
    const $ = (id) => document.getElementById(id);
    $('btnMap').addEventListener('click', () => this.map.toggle());
    $('btnSwitch').addEventListener('click', () => this.switchLeader());
    $('btnSound').addEventListener('click', () => {
      this.audio.setEnabled(!this.audio.enabled);
      $('btnSound').textContent = this.audio.enabled ? '🔊' : '🔇';
    });
    $('btnMenu').addEventListener('click', () => this.toggleMenu(true));
    $('btnResume').addEventListener('click', () => this.toggleMenu(false));
    $('btnRestart').addEventListener('click', () => {
      if (confirm('처음부터 다시 시작할까요? 저장된 진행이 지워져요.')) { localStorage.removeItem(SAVE_KEY); location.reload(); }
    });
    $('optShadows').addEventListener('change', (e) => {
      this.renderer.shadowMap.enabled = e.target.checked;
      this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    });
    $('optMusic').addEventListener('change', (e) => { this.audio.music = e.target.checked; });
  }

  toggleMenu(v) {
    this.paused = v;
    document.getElementById('menu').classList.toggle('hidden', !v);
  }

  label(pos, text, { big = false, island = null } = {}) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.font = `bold ${big ? 60 : 48}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = 'rgba(10,40,60,0.8)';
    g.strokeText(text, 256, 64);
    g.fillStyle = big ? '#ffe9a8' : '#ffffff';
    g.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    s.position.copy(pos);
    s.scale.set(big ? 60 : 12, big ? 15 : 3, 1);
    s.userData = { big, island };
    this.scene.add(s);
    this.labels.push(s);
    return s;
  }

  addInteractable(it) { this.interactables.push(it); return it; }

  // ---------- 캐릭터 ----------
  get leader() { return this._leader || this.moana; }
  get companion() { return this.leader === this.moana ? this.maui : this.moana; }
  leaderFor() { return this.moana; }

  switchLeader() {
    if (!this.flags.mauiJoined) { this.hud.toast('마우이를 만난 뒤에 바꿀 수 있어요!'); return; }
    const next = this.companion;
    this.leader.controlledBy = 'ai';
    next.controlledBy = 'local';
    this._leader = next;
    this.hud.toast(`${next.kind === 'moana' ? '🌺' : '🪝'} 이제 ${josa(next.name, '을', '를')} 조종해요!`);
    this.audio.play('pickup');
  }

  aiCommand(c) {
    const cmd = emptyCommand();
    cmd.worldX = 0; cmd.worldZ = 0;
    if (c.state === 'rescue' || c.state === 'frozen' || c.state === 'helm' || c.state === 'climb') return cmd;
    if (c.kind === 'maui' && !this.flags.mauiJoined) return cmd;
    const L = this.leader;
    const lp = L.worldPos(new THREE.Vector3());
    const cp = c.worldPos(new THREE.Vector3());
    const d = Math.hypot(lp.x - cp.x, lp.z - cp.z);
    const b = this.boat;
    c.ai.cool = (c.ai.cool || 0) - 1 / 60;
    if (c.form === 'hawk') {
      const goal = L.onBoat ? new THREE.Vector3(b.x, 0, b.z) : lp;
      const dx = goal.x - cp.x, dz = goal.z - cp.z;
      const gd = Math.hypot(dx, dz);
      if (gd > 3) { cmd.worldX = dx / gd; cmd.worldZ = dz / gd; cmd.run = gd > 30; }
      if (gd < 6 && c.ai.cool <= 0) { cmd.transform = true; c.ai.cool = 2; }
      cmd.jumpHeld = cp.y < goal.y + 12 && gd > 15;
      cmd.downHeld = gd < 20;
      return cmd;
    }
    if (L.form === 'hawk') return cmd; // 새가 된 리더는 기다린다
    if (L.onBoat) {
      if (c.onBoat) {
        const seat = c.kind === 'maui' ? new THREE.Vector3(-1.3, 0, 3.4) : new THREE.Vector3(0.9, 0, -1.3);
        if (L.state === 'helm' && c.kind === 'moana') seat.set(-1.2, 0, -3.2);
        const dx = seat.x - c.pos.x, dz = seat.z - c.pos.z;
        const sd = Math.hypot(dx, dz);
        if (sd > 0.5) {
          const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
          cmd.worldX = (dx * cs + dz * sn) / sd * 0.6;
          cmd.worldZ = (-dx * sn + dz * cs) / sd * 0.6;
        } else if (c.kind === 'maui' && c.state === 'ground') c.state = 'sit';
      } else if (c.ai.cool <= 0 && this.zone === 'surface') {
        c.ai.cool = 3;
        const bd = Math.hypot(b.x - cp.x, b.z - cp.z);
        if (c.kind === 'maui' && c.hasHook && bd > 40) cmd.transform = true;
        else this.rescue.start(c, { style: bd < 40 ? 'leap' : 'toss', to: 'boat' });
      }
      return cmd;
    }
    // 리더가 땅 위
    if (c.onBoat || d > 70) {
      if (c.ai.cool <= 0 && d > 10) {
        c.ai.cool = 3;
        if (c.kind === 'maui' && c.hasHook && d > 70) { cmd.transform = true; return cmd; }
        const spot = this.findLandNear(lp, 3);
        if (spot) this.rescue.start(c, { style: 'leap', to: spot });
      }
      return cmd;
    }
    if (d > 3.5) {
      cmd.worldX = (lp.x - cp.x) / d; cmd.worldZ = (lp.z - cp.z) / d;
      cmd.run = d > 9;
      // 막히면 점프
      c.ai.stuck = (c.ai.last && c.ai.last.distanceTo(cp) < 0.02) ? (c.ai.stuck || 0) + 1 : 0;
      c.ai.last = cp.clone();
      if (c.ai.stuck > 20) { cmd.jump = true; c.ai.stuck = 0; }
    }
    return cmd;
  }

  findLandNear(p, minR = 3) {
    for (let r = minR; r < 40; r += 3) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        const h = heightAt(x, z);
        if (h > 0.4) return new THREE.Vector3(x, h, z);
      }
    }
    return null;
  }

  findLandingPoint() {
    const b = this.boat;
    let best = null, bd = Infinity;
    for (let r = 6; r <= 34; r += 4) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = b.x + Math.sin(a) * r, z = b.z + Math.cos(a) * r;
        const h = heightAt(x, z);
        if (h > 0.5 && r < bd) {
          const x2 = x + Math.sin(a) * 3, z2 = z + Math.cos(a) * 3;
          best = new THREE.Vector3(x2, heightAt(x2, z2), z2); bd = r;
        }
      }
      if (best) break;
    }
    return best;
  }

  // ---------- 상호작용 ----------
  findInteraction(c) {
    const opts = [];
    const add = (dist, label, action, priority = 0) => opts.push({ dist, label, action, priority });
    const b = this.boat;
    if (c.state === 'rescue' || c.state === 'frozen') return null;
    if (c.state === 'helm') return { label: '⛵ 키 놓기', action: () => c.leaveHelm() };
    if (c.state === 'climb') return { label: c.climb.kind === 'mast' ? '⬇️ 돛대에서 손 놓기' : '⬇️ 손 놓기', action: () => { c.climb = null; c.state = 'air'; } };
    if (c.carrying) {
      const cr = c.carrying;
      if (cr.kind === 'heihei' && c.onBoat && Math.hypot(c.pos.x - BOX.x, c.pos.z - BOX.z) < 2) {
        return { label: '📦 헤이헤이를 상자에 넣기', action: () => { c.carrying = null; cr.enterBox(); this.hud.toast('헤이헤이가 상자 속에 쏙! 🐔📦'); } };
      }
      return { label: `${cr.name} 내려놓기`, action: () => c.dropCarried() };
    }
    if (c.form === 'hawk') return null;
    const cp = c.worldPos(new THREE.Vector3());
    if (c.onBoat) {
      const dh = Math.hypot(c.pos.x - HELM.x, c.pos.z - HELM.z);
      if (dh < 1.8) add(dh, '⛵ 키 잡기 (배 조종)', () => c.takeHelm(), 1);
      const dm = Math.hypot(c.pos.x - MAST.x, c.pos.z - MAST.z);
      if (dm < 1.4) add(dm, '🧗 돛대 오르기 (위 = 올라가기)', () => c.startClimb(this.climbables[0]), 1);
      const db = Math.hypot(c.pos.x - BOX.x, c.pos.z - BOX.z);
      if (db < 1.9) {
        if (this.heihei.inBox) add(db, '📦 상자 열기 (헤이헤이 꺼내기)', () => this.heihei.exitBox(), 1);
        else add(db, '📦 상자 열어 보기', () => {
          b.box.target = b.box.target ? 0 : 1;
          this.hud.toast(b.box.target ? '상자가 비어 있어요. 헤이헤이를 안아서 넣을 수 있어요!' : '상자를 닫았어요.');
        });
      }
      if (this.zone === 'surface') {
        const land = this.findLandingPoint();
        if (land) add(5, '🏝️ 섬에 내리기', () => this.rescue.start(c, { style: 'leap', to: land }));
      }
    } else if (b.unlocked && this.zone === 'surface') {
      const bd = Math.hypot(cp.x - b.x, cp.z - b.z);
      if (bd < 26) add(bd * 0.3, '⛵ 배에 타기', () => this.rescue.start(c, { style: 'leap', to: 'boat' }));
    }
    for (const cr of this.critters) {
      if (['inBox', 'rescue', 'stolen', 'carried'].includes(cr.state)) continue;
      if (cr.onBoat !== c.onBoat) continue;
      const d = cr.onBoat ? cr.pos.distanceTo(c.pos) : cr.pos.distanceTo(cp);
      if (d < 1.6) add(d, `${cr.kind === 'heihei' ? '🐔' : '🐷'} ${cr.name} 안아 들기`, () => c.pickUp(cr), 1);
    }
    if (!c.onBoat) {
      for (const n of Object.values(this.npcs)) {
        if (!n.visible) continue;
        const d = n.pos.distanceTo(cp);
        if (d < 3.2) add(d, `💬 ${josa(n.name, '과', '와')} 이야기하기`, () => this.dialog.show(n.nextLines()), 1);
      }
    }
    for (const it of this.interactables) {
      if (it.zone && it.zone !== this.zone) continue;
      if (!it.zone && this.zone !== 'surface') continue;
      if (it.onlyKind && it.onlyKind !== c.kind) continue;
      if (it.enabled && !it.enabled(c)) continue;
      const p = it.getPos ? it.getPos() : it.pos;
      const d = Math.hypot(p.x - cp.x, p.z - cp.z);
      if (d < it.radius && Math.abs(p.y - cp.y) < Math.max(6, it.radius)) add(d, typeof it.label === 'function' ? it.label(c) : it.label, () => it.action(c), it.priority || 0);
    }
    if (!opts.length) return null;
    opts.sort((a, b2) => (b2.priority - a.priority) || (a.dist - b2.dist));
    return opts[0];
  }

  eat(c) {
    const inv = this.inventory;
    const menu = [
      ['meal', 60, 99, '🍲 잔치 한 상'], ['fish', 30, 2, '🐟 생선'], ['taro', 25, 1, '🥔 타로'],
      ['breadfruit', 25, 1, '🍈 빵나무 열매'], ['banana', 15, 1, '🍌 바나나'], ['coconut', 12, 1, '🥥 코코넛'],
    ];
    const f = menu.find(([k]) => inv[k] > 0);
    if (!f) { this.hud.toast('먹을 게 없어요. 마을 가판대나 야자수에서 구해요!'); return; }
    inv[f[0]]--;
    c.hunger = Math.min(100, c.hunger + f[1]);
    c.hp = Math.min(c.maxHp, c.hp + f[2]);
    this.audio.play('eat');
    this.hud.toast(`${c.name}: 냠냠! ${f[3]}`);
  }

  collectCoconut(who) {
    this.inventory.coconut++;
    this.audio.play('pickup');
    if (this.quests.is('coconuts')) {
      this.flags.coconutCount = (this.flags.coconutCount || 0) + 1;
      if (this.flags.coconutCount >= 3) {
        this.dialog.show(LINES.blackCoconut, () => this.quests.advance('coconuts'));
      } else this.hud.toast(`🥥 코코넛 ${this.flags.coconutCount}/3`);
    } else this.hud.toast('🥥 코코넛 +1 (던지거나 먹을 수 있어요)');
  }

  // ---------- 대화 ----------
  talkTui() {
    const q = this.quests;
    if (q.is('intro')) return this.dialog.show(LINES.tuiIntro, () => q.advance('intro'));
    if (q.is('coconuts')) return [{ who: '투이 족장', text: `코코넛은 야자수를 흔들면 떨어진단다. (${this.flags.coconutCount || 0}/3)` }];
    if (q.is('coconutsReturn')) return this.dialog.show(LINES.tuiCoconuts, () => q.advance('coconutsReturn'));
    if (q.is('homecoming')) return this.dialog.show(LINES.homecoming, () => this.finishChapter1());
    const lines = this.flags.restored
      ? ['모아나, 네가 우리 마을의 자랑이다.', '다음 항해는 어디로 가니? 조심하거라.']
      : ['바다는 위험하단다, 모아나.', '족장이 되면 산꼭대기 돌탑에 돌을 올리게 될 거다.'];
    return [{ who: '투이 족장', text: lines[Math.floor(Math.random() * lines.length)] }];
  }

  talkTala() {
    const q = this.quests;
    if (q.is('tala')) return this.dialog.show(LINES.tala, () => q.advance('tala'));
    if (q.is('cave')) return [{ who: '탈라 할머니', text: '폭포 옆 숨겨진 동굴이란다. 북을 쳐 보렴.' }];
    if (q.is('heart')) return this.dialog.show(LINES.heart, () => q.advance('heart'));
    if (q.is('call')) return this.dialog.show(LINES.call, () => q.advance('call'));
    const lines = ['바다를 믿으렴. 바다는 너를 사랑한단다.', '가끔은 네 마음의 목소리를 따라가야 해.', '가오리 문신이 보이니? 나는 다음 생에 가오리가 될 거란다.'];
    return [{ who: '탈라 할머니', text: lines[Math.floor(Math.random() * lines.length)] }];
  }

  talkMaui() {
    if (!this.quests.atLeast('findMaui')) {
      this.dialog.show([{ who: '마우이', text: '…누구지? (아직은 그냥 지나가는 것 같아요)' }]);
      return;
    }
    this.dialog.show(LINES.maui, () => {
      this.flags.mauiJoined = true;
      this.maui.ai.mode = 'follow';
      this.hud.toast('🪝 마우이가 동료가 되었어요! Tab / 🔄 으로 조종을 바꿀 수 있어요');
      if (this.quests.is('findMaui')) this.quests.advance('findMaui');
    });
  }

  talkCrew(kind) {
    const q = this.quests;
    const names = { moni: '모니', loto: '로토', kele: '켈레' };
    if (!q.is('crew')) return [{ who: names[kind], text: q.atLeast('clam') ? '우리 배 최고야! 🌊' : '안녕, 모아나!' }];
    if (this.flags['crew_' + kind]) return [{ who: names[kind], text: '배에서 만나!' }];
    this.dialog.show(LINES[kind], () => {
      this.flags['crew_' + kind] = true;
      if (kind === 'loto') this.boat.upgrade = 1.35;
      if (kind === 'kele') { this.inventory.meal += 2; this.inventory.fish += 3; this.inventory.coconut += 3; }
      if (['moni', 'loto', 'kele'].every((k) => this.flags['crew_' + k])) {
        this.dialog.show(LINES.crewDone, () => q.advance('crew'));
      }
    });
    return null;
  }

  nextCrewTarget() {
    for (const k of ['moni', 'loto', 'kele']) if (!this.flags['crew_' + k]) return this.npcs[k].pos;
    return null;
  }

  talkMatangi() {
    const q = this.quests;
    if (q.is('matangi')) return this.dialog.show(LINES.matangi, () => q.advance('matangi'));
    if (q.is('flowers')) return this.dialog.show([{ who: '마탕기', text: '꽃은 섬 곳곳에서 분홍빛으로 빛나고 있어. 호호.' }]);
    if (q.is('flowersReturn')) return this.dialog.show(LINES.matangiDone, () => q.advance('flowersReturn'));
    this.dialog.show([{ who: '마탕기', text: '또 왔어? 내 섬은 언제나 반짝반짝하지.' }]);
  }

  finishChapter1() {
    this.showBigText('1장 완료!', '테 피티의 심장을 돌려줬어요 💚');
    this.quests.advance('homecoming');
  }

  // ---------- 퀘스트 단계 ----------
  onStageEnter(stage, silent) {
    this.applyProgress();
    if (silent) return;
    switch (stage.id) {
      case 'setsail':
        this.boat.root.visible = true;
        this.hud.toast('⛵ 해변에 배가 준비됐어요!');
        break;
      case 'kakamora':
        this.hud.toast('동쪽 카카모라의 바다로! (⭐ 방향)');
        break;
      case 'restore':
        this.teka.startReveal();
        break;
      case 'teka':
        this.dialog.show(LINES.shapeshiftDone);
        break;
      case 'call':
        this.hud.toast('모투누이 마을에 새 친구들이 나타났어요!');
        break;
      case 'free':
        this.showBigText('모험 완료! 🎉', '모아나와 마우이, 최고의 항해자!');
        break;
      default: break;
    }
  }

  // 퀘스트 진행도에 맞게 월드 상태 맞추기 (불러오기에도 사용)
  applyProgress() {
    const q = this.quests;
    const b = this.boat;
    b.unlocked = q.atLeast('heart');
    b.root.visible = b.unlocked;
    this.flags.hasHeart = q.atLeast('setsail') && !q.atLeast('homecoming');
    this.moana.model.heart.visible = this.flags.hasHeart;
    this.flags.talaSpirit = q.atLeast('setsail');
    if (q.atLeast('kakamora')) { this.flags.mauiJoined = true; this.maui.ai.mode = 'follow'; }
    this.maui.setHook(q.atLeast('shapeshift'));
    if (q.atLeast('shapeshift')) this.flags.hookFound = true;
    if (q.atLeast('homecoming') && !this.flags.restoredApplied) {
      this.flags.restoredApplied = true;
      this.flags.restored = true;
      restoreBlight(this);
      this.teka.state = 'restored';
      this.teka.mesh.visible = false;
      this.teka.teFiti.visible = true;
    }
    if (q.atLeast('homecoming')) this.kakamora.setupFriendly();
    const ch2 = q.atLeast('call');
    for (const k of ['moni', 'loto', 'kele', 'simea']) this.npcs[k].setVisible(ch2);
    if (this.flags.crew_loto) b.upgrade = 1.35;
    if (q.atLeast('finale') && !this.ch2.risen) {
      this.ch2.risen = true;
      this.ch2.stormCleared = true;
      MOTUFETU.sink = 0;
      MOTUFETU.mesh.position.y = 0;
      this.onMotufetuRisen(true);
    }
    if (q.atLeast('flowers')) this.ch2.flowers.forEach((f) => { if (q.atLeast('flowersReturn')) f.taken = true; });
  }

  onMotufetuRisen(silent = false) {
    this.depthTex.userData.refresh(MOTUFETU);
    if (!this.flags.motufetuPalms) {
      this.flags.motufetuPalms = true;
      const palms = new THREE.InstancedMesh(palmGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), 150);
      const d = new THREE.Object3D();
      let n = 0;
      for (let i = 0; i < 600 && n < 150; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * MOTUFETU.radius;
        const x = MOTUFETU.x + Math.sin(a) * r, z = MOTUFETU.z + Math.cos(a) * r;
        const h = heightAt(x, z);
        if (h < 1.2 || h > 30) continue;
        d.position.set(x, h - 0.2, z); d.rotation.y = a * 7; d.scale.setScalar(0.8 + Math.random() * 0.5);
        d.updateMatrix();
        palms.setMatrixAt(n++, d.matrix);
      }
      palms.count = n;
      palms.castShadow = true;
      this.scene.add(palms);
    }
    storm.amount = 0;
    if (!silent) {
      this.showBigText('모투페투가 떠올랐어요!', '바다의 길이 다시 이어졌어요 🌈');
      this.dialog.show(LINES.raised, () => this.quests.advance('raise'));
    }
  }

  checkQuestTriggers() {
    const q = this.quests;
    const L = this.leader;
    const lp = L.worldPos(new THREE.Vector3());
    const b = this.boat;
    if (q.is('setsail') && this.moana.onBoat && Math.hypot(b.x - REEF.x, b.z - REEF.z) > REEF.r + 40 && !this.flags.stowawayStarted) {
      this.flags.stowawayStarted = true;
      const h = this.heihei;
      if (!h.onBoat) { h.state = 'wander'; h.enterBox(); }
      setTimeout(() => {
        if (this.heihei.inBox) this.heihei.exitBox();
        this.dialog.show(LINES.stowaway, () => q.advance('setsail'));
      }, 2500);
    }
    if (q.is('shapeshift')) {
      const m = this.maui;
      if (m.form === 'hawk') {
        const mp = m.worldPos(new THREE.Vector3());
        if (mp.y - Math.max(0, heightAt(mp.x, mp.z)) > 25 && !this.flags.shapeshiftDone) {
          this.flags.shapeshiftDone = true;
          q.advance('shapeshift');
        }
      }
    }
    if (q.is('teka') && Math.hypot(lp.x - TF.x, lp.z - TF.z) < 950) this.teka.awaken();
    if (q.is('homecoming') && Math.hypot(lp.x - this.npcs.tui.pos.x, lp.z - this.npcs.tui.pos.z) < 12 && !this.dialog.active && !this.flags.homecomingShown) {
      this.flags.homecomingShown = true;
      this.dialog.show(LINES.homecoming, () => this.finishChapter1());
    }
    if (q.is('finale')) {
      const onIsland = !L.onBoat && L.form !== 'hawk' && Math.hypot(lp.x - MOTUFETU.x, lp.z - MOTUFETU.z) < MOTUFETU.radius && heightAt(lp.x, lp.z) > 0.5;
      if (onIsland && !this.dialog.active) this.dialog.show(LINES.finale, () => q.advance('finale'));
    }
  }

  // ---------- 연출 ----------
  fadeTransition(fn) {
    const el = document.getElementById('fade');
    el.style.transition = 'opacity 0.6s';
    el.style.background = '#000';
    el.style.opacity = '1';
    setTimeout(() => {
      fn();
      setTimeout(() => { el.style.opacity = '0'; }, 150);
    }, 650);
  }
  startCutscene(fn) { this.fadeTransition(fn); }

  showBigText(title, sub = '') {
    const el = document.getElementById('bigText');
    el.innerHTML = `${title}<small>${sub}</small>`;
    el.style.opacity = '1';
    clearTimeout(this._bigT);
    this._bigT = setTimeout(() => { el.style.opacity = '0'; }, 4200);
  }

  setZone(z) {
    this.zone = z;
    const surf = z === 'surface';
    this.ocean.mesh.visible = surf;
    this.sky.dome.visible = surf;
    this.sky.clouds.visible = surf;
    this.sky.stars.visible = surf;
    this.sky.moon.visible = surf;
    if (!surf) {
      this.scene.fog.color.set('#1a1030');
      this.scene.fog.near = 40; this.scene.fog.far = 320;
      this.scene.background = new THREE.Color('#1a1030');
      this.sky.hemi.color.set('#b080ff');
      this.sky.hemi.groundColor.set('#201040');
      this.sky.hemi.intensity = 1.2;
      this.sky.sun.intensity = 0.6;
    } else {
      this.scene.background = null;
      this.sky.hemi.groundColor.set('#3a5a40');
    }
  }

  // ---------- 저장 ----------
  save() {
    if (!this.started) return;
    const L = this.moana;
    const data = {
      v: 1, stage: this.quests.index, flags: this.flags, inv: this.inventory, time: this.timeOfDay,
      moana: { hp: this.moana.hp, hunger: this.moana.hunger }, maui: { hp: this.maui.hp, hunger: this.maui.hunger },
      boat: { x: this.boat.x, z: this.boat.z, yaw: this.boat.yaw },
      player: this.zone === 'surface' ? { onBoat: L.onBoat, x: L.pos.x, y: L.pos.y, z: L.pos.z } : null,
      map: this.map.serialize(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* 저장 실패 무시 */ }
  }

  static hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  load() {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { d = null; }
    if (!d) return false;
    this.flags = { ...d.flags, restoredApplied: false };
    Object.assign(this.inventory, d.inv);
    this.timeOfDay = d.time ?? 0.3;
    Object.assign(this.moana, d.moana); Object.assign(this.maui, d.maui);
    this.boat.setPose(d.boat.x, d.boat.z, d.boat.yaw);
    this.map.load(d.map);
    this.quests.index = clamp(d.stage, 0, STAGES.length - 1);
    // 랄로타이 안에서 저장됐다면 괴물의 섬 입구 단계로
    if (this.quests.is('tamatoa')) this.quests.index = this.quests.idx('lalotai');
    this.placeForStart(d.player);
    this.quests.setStage(this.quests.id, true);
    return true;
  }

  placeForStart(player) {
    const m = this.moana;
    const q = this.quests;
    this.boat.unlocked = q.atLeast('heart');
    this.boat.update(0.016, 0, this);
    if (player && player.onBoat && this.boat.unlocked) m.placeOnBoat(new THREE.Vector3(clamp(player.x, -2, 2), 0, clamp(player.z, -5, 5)));
    else if (player && !player.onBoat) m.setWorld(new THREE.Vector3(player.x, heightAt(player.x, player.z), player.z));
    else if (player === null && this.boat.unlocked && q.atLeast('findMaui')) m.placeOnBoat(new THREE.Vector3(0.8, 0, -1.4));
    else m.setWorld(new THREE.Vector3(PLAYER_START.x, heightAt(PLAYER_START.x, PLAYER_START.z), PLAYER_START.z));
    m.state = 'ground';
    // 마우이
    const mw = this.maui;
    if (this.flags.mauiJoined || q.atLeast('kakamora')) {
      if (m.onBoat) mw.placeOnBoat(new THREE.Vector3(-1.3, 0, 3.2));
      else {
        const s = this.findLandNear(m.pos, 3) || m.pos.clone();
        mw.setWorld(s);
      }
    } else {
      mw.setWorld(this.locations.mauiSpawn.clone());
      mw.facing = Math.PI;
    }
    mw.state = 'ground';
    // 헤이헤이와 푸아
    const h = this.heihei;
    if (q.atLeast('findMaui') && this.boat.unlocked) h.placeOnBoat(new THREE.Vector3(-1, 0, -2));
    else { h.home.set(8, 0, 78); h.setWorld(new THREE.Vector3(8, heightAt(8, 78), 78)); }
    h.home.set(8, 0, 78);
    const p = this.pua;
    p.home.set(-36, 0, 62);
    p.setWorld(new THREE.Vector3(-36, heightAt(-36, 62), 62));
  }

  newGame() {
    this.quests.index = 0;
    this.placeForStart(null);
    this.camRig.yaw = Math.PI;
    this.quests.setStage('intro', true);
  }

  // ---------- 루프 ----------
  start() {
    this.started = true;
    this.moana.controlledBy = 'local';
    this.maui.controlledBy = 'ai';
    this._leader = this.moana;
    this.hud.show();
    this.map.reveal(0, 0, 600);
    this.lastT = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    const now = performance.now();
    const raw = (now - this.lastT) / 1000;
    const dt = Math.min(raw, 0.05);
    this.lastT = now;
    this.adaptQuality(raw);
    if (!this.paused) this.update(dt);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  // 느린 기기에서는 해상도와 그림자를 자동으로 낮춤
  adaptQuality(raw) {
    if (this.paused || document.hidden) return;
    const q = (this._q ||= { t: 0, n: 0, sum: 0, level: 0 });
    q.t += raw; q.n++; q.sum += raw;
    if (q.t < 4) return;
    const avg = q.sum / q.n;
    q.t = 0; q.n = 0; q.sum = 0;
    if (avg > 1 / 28 && q.level < 2) {
      q.level++;
      if (q.level === 1) this.renderer.setPixelRatio(1);
      if (q.level === 2) {
        this.renderer.shadowMap.enabled = false;
        document.getElementById('optShadows').checked = false;
        this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      }
      this.resize();
    }
  }

  update(dt) {
    const input = this.input;
    this.time += dt;
    this.timeOfDay = (this.timeOfDay + dt / 600) % 1;
    this.wind.yaw = 2.4 + Math.sin(this.time * 0.01) * 1.1;

    // 전역 키
    if (input.consume('map')) this.map.toggle();
    if (input.consume('menu')) { if (this.map.open) this.map.toggle(false); else this.toggleMenu(!this.paused); }
    if (input.consume('switch')) this.switchLeader();

    this.dialog.update(dt, input);
    const blocked = this.dialog.active || this.map.open;
    const L = this.leader;
    const cmd = blocked ? emptyCommand() : input.command();
    cmd.camYaw = this.camRig.yaw;
    L.cmd = cmd;
    const comp = this.companion;
    comp.cmd = this.aiCommand(comp);

    this.boat.update(dt, this.time, this);
    for (const c of this.characters) c.update(dt);
    for (const c of this.critters) c.update(dt);
    const lp = L.worldPos(new THREE.Vector3());
    const nearHome = this.zone === 'surface' && Math.hypot(this.camera.position.x, this.camera.position.z) < 900;
    this.village.group.visible = nearHome;
    if (nearHome) {
      for (const n of Object.values(this.npcs)) n.update(dt, lp, this.camera.position);
      this.village.update(dt, this.time, this.sky.light);
    } else for (const n of Object.values(this.npcs)) n.mesh.visible = false;

    // 상호작용
    const it = blocked ? null : this.findInteraction(L);
    this.hud.prompt(it && it.label);
    if (it && cmd.interact) {
      const res = it.action();
      if (Array.isArray(res)) this.dialog.show(res);
    }
    if (cmd.eat) this.eat(L);

    this.locations.update(dt, this.time);
    this.lalotai.update(dt, this.time);
    this.teka.update(dt, this.time);
    this.kakamora.update(dt, this.time);
    this.ch2.update(dt, this.time);
    this.manta.update(dt, this.time);
    this.rescue.update(dt);
    this.combat.update(dt);
    this.effects.update(dt);
    if (!this.dialog.active) this.checkQuestTriggers();
    updateReefFoam(this, this.time);

    // 배고픔
    for (const c of this.characters) {
      const before = c.hunger;
      c.hunger = Math.max(0, c.hunger - dt * (c.state === 'helm' || c.state === 'climb' || c.form === 'hawk' ? 0.3 : 0.2));
      if (c === L && before > 20 && c.hunger <= 20) this.hud.toast(`${josa(c.name, '이', '가')} 배고파요! 🍽️ (R / 먹기 버튼)`);
    }

    // 지도 밝히기
    if (this.zone === 'surface') {
      const r = L.atMastTop ? 1100 : L.form === 'hawk' ? 400 + lp.y * 3 : 500;
      this.map.reveal(lp.x, lp.z, r);
      if (L.atMastTop && !this.flags.mastTip) { this.flags.mastTip = true; this.hud.toast('🔭 돛대 위에서는 훨씬 멀리 보여요! 지도(M)를 확인해요'); }
    }
    for (const s of this.labels) {
      const d = s.position.distanceTo(this.camera.position);
      if (s.userData.big) {
        const isl = s.userData.island;
        s.visible = this.zone === 'surface' && d > 150 && d < 1400 && (!isl || this.map.discovered.has(isl.id)) && !(isl && isl.sink > 1);
      } else s.visible = this.zone === 'surface' && d < 90;
    }

    this.camRig.update(dt, this, input);
    if (this.zone === 'surface') {
      this.sky.update(this.timeOfDay, this.camera.position, this.scene.fog, this.ocean, this.stormAmount);
      this.ocean.update(this.time, this.camera, this.scene.fog);
    } else {
      this.sky.sun.position.copy(lp).add(new THREE.Vector3(30, 80, 20));
      this.sky.sun.target.position.copy(lp);
    }
    this.hud.update();
    this.audio.update(dt, { sailing: this.boat.speed > 3, storm: this.stormAmount, night: 1 - this.sky.light });
    if (this.map.open && Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) this.map.draw();

    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; this.save(); }
  }

  // 디버그/테스트용
  debugTeleport(x, z, onBoat = false) {
    const L = this.leader;
    if (onBoat) { this.boat.setPose(x, z, this.boat.yaw); L.placeOnBoat(new THREE.Vector3(0, 0, 0)); }
    else L.setWorld(new THREE.Vector3(x, heightAt(x, z) + 1, z));
  }
}

export { SAVE_KEY, DECK, ZONES, smoothstep };
