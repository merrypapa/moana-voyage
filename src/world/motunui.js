// 모투누이 마을: 오두막, 음식, 코코넛, 모닥불, 동굴, 족장의 돌탑, 마을 사람들
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { buildFale, buildStall, buildSmallCanoe, palmGeometry } from './props.js';
import { mat, part } from '../entities/models.js';
import { NPC } from '../entities/npc.js';
import { muralTexture } from '../textures.js';
import { LINES } from '../systems/quests.js';
import { bakeInto } from './bake.js';

const G = (x, z) => heightAt(x, z);
export const PLAZA = new THREE.Vector3(0, 0, 70);

const VILLAGER_LINES = [
  '오늘 아침에 잡은 물고기가 너무 작아… 예전엔 이렇지 않았는데.',
  '모아나, 코코넛은 버릴 게 하나도 없단다! 껍질로는 밧줄, 속은 음식, 물은 음료!',
  '암초 밖은 위험해. 족장님이 절대 나가지 말라고 하셨어.',
  '우리 마을 모닥불 요리 먹어봤니? 타로랑 생선을 같이 구우면 최고야!',
  '헤이헤이 또 돌 쪼고 있더라. 저 닭은 정말… 특별해.',
  '푸아는 모아나만 졸졸 따라다니네. 귀여워라~',
  '산꼭대기 족장의 돌탑에 돌을 올려 봤니? 언젠가 너도 올리게 될 거야.',
  '밤하늘의 별을 보면 왠지 멀리 떠나고 싶어져.',
  '예전에 할머니한테 들었는데, 우리 조상들은 큰 배를 타고 다녔대. 진짜일까?',
];
const HAPPY_LINES = [
  '모아나 덕분에 코코넛이 다시 하얘졌어! 고마워!',
  '물고기가 돌아왔어! 오늘 저녁은 잔치다~!',
  '우리도 곧 배를 타고 다른 섬에 가 볼 거야!',
  '마우이를 직접 봤다고? 사인 좀 받아 줄 수 있어?',
];

export class Village {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.palms = [];
    this.fireLights = [];
    this.stonesPlaced = 0;
    this.build();
  }

  place(obj, x, z, yaw = 0, dy = 0) {
    obj.position.set(x, G(x, z) + dy, z);
    obj.rotation.y = yaw;
    this.group.add(obj);
    return obj;
  }

  build() {
    const game = this.game;
    // 족장 집 + 오두막들
    this.place(buildFale(1, true), 0, 30, 0);
    const huts = [[-42, 55], [-46, 88], [-30, 112], [42, 55], [46, 88], [30, 112], [-72, 72], [72, 72], [-62, 118], [62, 120], [-95, 140], [95, 138]];
    huts.forEach(([x, z], i) => this.place(buildFale(0.9 + (i % 3) * 0.1), x, z, i));
    game.label(new THREE.Vector3(-42, G(-42, 55) + 8, 55), '모아나의 집');

    // 모닥불
    const fire = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      part('sphere', mat('#6b665e'), 0.45, 0.3, 0.45, Math.cos(a) * 1.5, 0.15, Math.sin(a) * 1.5, fire);
    }
    for (let i = 0; i < 4; i++) {
      const l = part('cyl', mat('#5a3a1c'), 0.12, 1.8, 0.12, 0, 0.3, 0, fire);
      l.rotation.set(Math.PI / 2.3, (i / 4) * Math.PI * 2, 0);
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.85 });
    this.flames = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.5 - i * 0.12, 1.6 - i * 0.3, 7), i === 0 ? flameMat : new THREE.MeshBasicMaterial({ color: i === 1 ? '#ff7020' : '#ffe080', transparent: true, opacity: 0.8 }));
      f.position.y = 0.8;
      f.userData.keep = true;
      fire.add(f);
      this.flames.push(f);
    }
    const fl = new THREE.PointLight('#ffa040', 0, 30, 1.5);
    fl.position.y = 2;
    fire.add(fl);
    this.fireLights.push(fl);
    this.place(fire, PLAZA.x, PLAZA.z);
    game.addInteractable({
      pos: new THREE.Vector3(PLAZA.x, G(PLAZA.x, PLAZA.z), PLAZA.z), radius: 3.2,
      label: () => (game.inventory.taro > 0 && game.inventory.fish > 0 ? '🔥 요리하기 (타로 + 생선 → 잔치 한 상)' : '🔥 모닥불 (타로와 생선이 있으면 요리!)'),
      action: () => {
        const inv = game.inventory;
        if (inv.taro > 0 && inv.fish > 0) {
          inv.taro--; inv.fish--; inv.meal++;
          game.audio.play('cook');
          game.hud.toast('🍲 잔치 한 상 완성! (R/먹기 버튼으로 먹어요)');
        } else {
          game.hud.toast('타로 🥔 와 생선 🐟 을 가판대에서 가져오세요!');
        }
      },
    });

    // 음식 가판대
    const stalls = [
      { x: -15, z: 62, item: 'banana', name: '바나나', emoji: '🍌', color: '#f2d24a', shape: 'banana' },
      { x: 15, z: 62, item: 'taro', name: '타로', emoji: '🥔', color: '#8a6a8a', shape: 'sphere' },
      { x: -13, z: 83, item: 'fish', name: '생선', emoji: '🐟', color: '#6aa0c0', shape: 'fish' },
      { x: 13, z: 83, item: 'breadfruit', name: '빵나무 열매', emoji: '🍈', color: '#9ac04a', shape: 'sphere' },
    ];
    for (const s of stalls) {
      const st = buildStall(s.color, s.shape);
      const yaw = Math.atan2(PLAZA.x - s.x, PLAZA.z - s.z);
      this.place(st, s.x, s.z, yaw);
      game.addInteractable({
        pos: new THREE.Vector3(s.x, G(s.x, s.z), s.z), radius: 2.8,
        label: () => `${s.emoji} ${s.name} 가져가기`,
        action: () => {
          game.inventory[s.item]++;
          game.audio.play('pickup');
          game.hud.toast(`${s.emoji} ${s.name} +1`);
        },
      });
    }

    // 코코넛 수확 야자수
    const palmGeo = palmGeometry({ coconuts: false, height: 8 });
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    const spots = [[-25, 138], [-8, 150], [10, 143], [27, 133], [-52, 145], [52, 150], [-88, 100], [88, 100], [-100, 55], [100, 52], [-20, 175], [22, 178]];
    this.nutMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#6b4a1c'), spots.length * 4);
    this.nutMesh.castShadow = true;
    this.nutMesh.userData.dynamic = true;
    this.group.add(this.nutMesh);
    const dm = new THREE.Object3D();
    spots.forEach(([x, z], ti) => {
      const tree = new THREE.Group();
      tree.userData.dynamic = true;
      const trunk = new THREE.Mesh(palmGeo, vc);
      trunk.castShadow = true;
      tree.add(trunk);
      const top = palmGeo.userData.top;
      const yaw = (ti * 2.39) % (Math.PI * 2);
      this.place(tree, x, z, yaw);
      tree.updateMatrixWorld(true);
      const nuts = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const wp = tree.localToWorld(new THREE.Vector3(top.x + Math.cos(a) * 0.4, top.y - 0.4, Math.sin(a) * 0.4));
        const idx = ti * 4 + i;
        dm.position.copy(wp); dm.scale.set(0.3, 0.32, 0.3); dm.updateMatrix();
        this.nutMesh.setMatrixAt(idx, dm.matrix);
        nuts.push({ idx, pos: wp, visible: true });
      }
      const palm = { tree, nuts, regrow: 0, shake: 0, x, z };
      this.palms.push(palm);
      game.addInteractable({
        pos: new THREE.Vector3(x, G(x, z), z), radius: 2.6,
        label: () => (palm.nuts.some((n) => n.visible) ? '🌴 야자수 흔들기 (코코넛)' : '🌴 코코넛이 다시 열릴 때까지 기다려요'),
        action: (who) => this.shakePalm(palm, who),
      });
    });
    this.nutMesh.instanceMatrix.needsUpdate = true;
    // 코코넛 떨어지는 효과
    this.falling = [];

    // 타로 밭
    const taroLeaf = new THREE.ConeGeometry(0.6, 0.2, 5);
    for (let i = 0; i < 60; i++) {
      const x = -85 + (i % 10) * 3.2, z = 10 + Math.floor(i / 10) * 3.2;
      const l = new THREE.Mesh(taroLeaf, mat(i % 2 ? '#3f8a3a' : '#2f7a34'));
      l.position.set(x, G(x, z) + 0.6, z);
      l.rotation.set(0.3, i, 0.2);
      this.group.add(l);
    }
    part('box', mat('#5a4a30'), 34, 0.1, 21, -70, G(-70, 18) + 0.05, 18, this.group);

    // 해변 카누
    for (const [x, z, y] of [[45, 214, 0.3], [62, 208, 0.6], [80, 200, 0.9], [-40, 216, -0.2]]) {
      this.place(buildSmallCanoe(), x, z, y, 0.1);
    }

    // 숨겨진 동굴 + 폭포
    this.buildCave(-118, -5);

    // 족장의 돌탑 (산꼭대기)
    let peak = { x: 0, z: -125, h: -1e9 };
    for (let dx = -30; dx <= 30; dx += 3) for (let dz = -30; dz <= 30; dz += 3) {
      const h = G(dx, -125 + dz);
      if (h > peak.h) peak = { x: dx, z: -125 + dz, h };
    }
    this.pile = new THREE.Group();
    this.pile.userData.dynamic = true;
    this.pile.position.set(peak.x, peak.h, peak.z);
    this.group.add(this.pile);
    for (let i = 0; i < 9; i++) this.addStone();
    game.addInteractable({
      pos: this.pile.position.clone(), radius: 3.5,
      label: () => (game.flags.placedStone ? '🪨 족장의 돌탑 (이미 돌을 올렸어요)' : '🪨 족장의 돌탑에 돌 올리기'),
      action: () => {
        if (game.flags.placedStone) { game.hud.toast('모투누이가 한눈에 보여요! 🏝️'); return; }
        game.flags.placedStone = true;
        this.addStone(true);
        game.audio.play('quest');
        game.hud.toast('🪨 족장의 돌을 올렸어요! 언젠가 모아나도 족장이 될 거예요.');
      },
    });

    bakeInto(this.group);

    // NPC
    const npcs = game.npcs;
    npcs.tui = new NPC(game, 'tui', { name: '투이 족장', x: 4, z: 50, facing: 0, wander: 0, activity: 'idle', talk: () => game.talkTui() });
    npcs.sina = new NPC(game, 'sina', { name: '시나 (엄마)', x: -10, z: 48, wander: 5, lines: ['모아나, 밥은 먹었니? 가판대에서 먹을 걸 챙기렴.', '아빠는 널 걱정해서 그러는 거야. 바다를 무서워하셔서…', '헤이헤이는 또 어디 갔을까?'] });
    npcs.tala = new NPC(game, 'tala', { name: '탈라 할머니', x: -82, z: 198, wander: 0, activity: 'dance', talk: () => game.talkTala() });
    const vpos = [[-20, 95], [25, 100], [-55, 80], [58, 85], [35, 45], [-30, 40], [70, 190], [-5, 190], [-65, 30], [10, 120]];
    vpos.forEach(([x, z], i) => {
      npcs['v' + i] = new NPC(game, 'villager', {
        name: ['마을 사람 레이', '어부 파울로', '할아버지 투', '직조공 레아', '꼬마 시오네', '아주머니 말리아', '어부 로마', '청년 필리', '농부 아피', '소녀 루아'][i],
        x, z, seed: i * 7 + 3, wander: 10,
        activity: i === 4 ? 'dance' : 'wander',
        talk: () => [{ who: npcs['v' + i].name, text: (game.flags.restored ? HAPPY_LINES : VILLAGER_LINES)[(i + (npcs['v' + i].lineIdx++ || 0)) % (game.flags.restored ? HAPPY_LINES.length : VILLAGER_LINES.length)] }],
      });
    });
    // 2장 선원들 (처음엔 숨김)
    npcs.moni = new NPC(game, 'moni', { name: '모니', x: 22, z: 95, wander: 3, visible: false, talk: () => game.talkCrew('moni') });
    npcs.loto = new NPC(game, 'loto', { name: '로토', x: 52, z: 202, wander: 3, visible: false, talk: () => game.talkCrew('loto') });
    npcs.kele = new NPC(game, 'kele', { name: '켈레', x: -62, z: 22, wander: 4, visible: false, talk: () => game.talkCrew('kele') });
    npcs.simea = new NPC(game, 'simea', { name: '시메아 (동생)', x: -36, z: 64, wander: 4, visible: false, talk: () => LINES.simea });
  }

  addStone(anim = false) {
    const i = this.pile.children.length;
    const layer = Math.floor(Math.sqrt(i));
    const a = i * 2.4;
    const r = Math.max(0, 1.4 - layer * 0.45);
    const s = part('sphere', mat(i % 2 ? '#7a746a' : '#8f887c'), 0.5, 0.3, 0.45, Math.cos(a) * r, 0.25 + layer * 0.45, Math.sin(a) * r, this.pile);
    s.userData.targetY = s.position.y;
    if (anim) { s.position.y += 3; s.userData.drop = true; }
  }

  buildCave(x, z) {
    const game = this.game;
    const g = new THREE.Group();
    const rockM = mat('#4f4a44');
    const face = Math.atan2(PLAZA.x - x, PLAZA.z - z);
    // 바위 아치
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      const r = 5.5;
      part('sphere', rockM, 2.2, 2.0, 2.4, Math.cos(a) * r, Math.sin(a) * r * 1.1, 0, g);
    }
    part('sphere', rockM, 9, 8, 6, 0, 3, -4.5, g);
    // 어두운 입구
    const hole = new THREE.Mesh(new THREE.CircleGeometry(4.2, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#0d0b0a' }));
    hole.position.set(0, 0.2, -0.8);
    g.add(hole);
    // 동굴 벽화
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshStandardMaterial({ map: muralTexture(), emissive: '#3a2a1a', emissiveIntensity: 0.4 }));
    mural.position.set(0, 3.2, -0.7);
    g.add(mural);
    this.mural = mural;
    // 안쪽의 조상들의 배
    for (const [bx, s] of [[-2.2, 0.35], [1.8, 0.4]]) {
      const c = buildSmallCanoe('#6a4424', true);
      c.scale.setScalar(s);
      c.position.set(bx, 0.3, -1.2);
      c.rotation.y = Math.PI / 2;
      g.add(c);
    }
    // 통나무 북
    const drum = new THREE.Group();
    part('cyl', mat('#7a4a28'), 0.6, 1.1, 0.6, 0, 0.55, 0, drum);
    part('cyl', mat('#d8c8a8'), 0.55, 0.05, 0.55, 0, 1.12, 0, drum);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      part('box', mat('#3a2412'), 0.05, 1.0, 0.05, Math.cos(a) * 0.61, 0.55, Math.sin(a) * 0.61, drum);
    }
    drum.position.set(1.5, 0, 3.5);
    g.add(drum);
    // 횃불 빛
    const torch = new THREE.PointLight('#ffae55', 6, 18, 1.6);
    torch.position.set(0, 3, 2);
    g.add(torch);
    this.caveLight = torch;
    this.place(g, x, z, face);
    g.updateMatrixWorld(true);
    this.drumPos = drum.getWorldPosition(new THREE.Vector3());
    game.label(new THREE.Vector3(x, G(x, z) + 11, z), '숨겨진 동굴');

    // 폭포
    const wf = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9fdcf5'; ctx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 80; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`; ctx.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 3, 20 + Math.random() * 40); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.waterfallTex = tex;
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(4, 18), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    fall.position.y = 9;
    wf.add(fall);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 16), new THREE.MeshStandardMaterial({ color: '#46c2e0', roughness: 0.1 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.15;
    wf.add(pool);
    for (let i = 0; i < 6; i++) part('sphere', mat('#ffffff', { transparent: true, opacity: 0.7 }), 0.8, 0.5, 0.8, (i - 2.5) * 0.7, 0.4, 0.5, wf);
    const wx = x + Math.sin(face + 1.3) * 10, wz = z + Math.cos(face + 1.3) * 10;
    this.place(wf, wx, wz, face);

    game.addInteractable({
      pos: this.drumPos.clone(), radius: 3,
      label: () => '🥁 통나무 북 치기',
      action: () => {
        game.audio.play('drum');
        if (game.quests.is('cave')) {
          game.startCutscene(() => {
            this.caveLight.intensity = 30;
            this.mural.material.emissiveIntensity = 1.5;
            game.dialog.show(LINES.cave, () => {
              game.quests.advance('cave');
            });
          });
        } else game.hud.toast('둥! 둥! 둥! 🥁');
      },
    });
  }

  shakePalm(palm, who) {
    const game = this.game;
    const nut = palm.nuts.find((n) => n.visible);
    palm.shake = 1;
    game.audio.play('shake');
    if (!nut) { game.hud.toast('코코넛이 아직 안 열렸어요 🌴'); return; }
    this.setNut(nut, false);
    palm.regrow = 45;
    const wp = nut.pos;
    const drop = part('sphere', mat('#6b4a1c'), 0.3, 0.32, 0.3, wp.x, wp.y, wp.z, this.scene);
    this.falling.push({ m: drop, vy: 0, ground: G(wp.x, wp.z) + 0.3, t: 0 });
    game.collectCoconut(who);
  }

  setNut(n, v) {
    n.visible = v;
    const dm = new THREE.Object3D();
    dm.position.copy(n.pos);
    dm.scale.setScalar(v ? 0.3 : 0.0001);
    dm.updateMatrix();
    this.nutMesh.setMatrixAt(n.idx, dm.matrix);
    this.nutMesh.instanceMatrix.needsUpdate = true;
  }

  nearestHarvestPalm(p) {
    let best = null, bd = Infinity;
    for (const palm of this.palms) {
      if (!palm.nuts.some((n) => n.visible)) continue;
      const d = Math.hypot(palm.x - p.x, palm.z - p.z);
      if (d < bd) { bd = d; best = palm; }
    }
    return best ? new THREE.Vector3(best.x, G(best.x, best.z), best.z) : PLAZA;
  }

  update(dt, t, light) {
    for (const f of this.flames) {
      f.scale.set(1 + Math.sin(t * 13 + f.id) * 0.12, 1 + Math.sin(t * 9 + f.id * 2) * 0.2, 1 + Math.cos(t * 11) * 0.12);
    }
    for (const l of this.fireLights) l.intensity = (1 - light) * 40 + 4 + Math.sin(t * 17) * 2;
    if (this.waterfallTex) this.waterfallTex.offset.y = (t * 1.2) % 1;
    for (const palm of this.palms) {
      if (palm.shake > 0) {
        palm.shake = Math.max(0, palm.shake - dt * 1.5);
        palm.tree.rotation.z = Math.sin(t * 30) * 0.05 * palm.shake;
      }
      if (palm.regrow > 0) {
        palm.regrow -= dt;
        if (palm.regrow <= 0) palm.nuts.forEach((n) => this.setNut(n, true));
      }
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      f.vy -= 20 * dt;
      f.m.position.y = Math.max(f.ground, f.m.position.y + f.vy * dt);
      if (f.t > 1.2) { this.scene.remove(f.m); this.falling.splice(i, 1); }
    }
    for (const s of this.pile.children) {
      if (s.userData.drop) {
        s.position.y = Math.max(s.userData.targetY, s.position.y - dt * 6);
        if (s.position.y <= s.userData.targetY) s.userData.drop = false;
      }
    }
  }
}
