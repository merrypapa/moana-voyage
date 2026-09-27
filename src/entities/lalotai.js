// 랄로타이(괴물의 세계)와 반짝이 게 타마토아
import * as THREE from 'three';
import { ZONES } from '../config.js';
import { mat, part, buildHook } from './models.js';
import { heightAt } from '../world/terrain.js';
import { approachAngle, josa } from '../util.js';
import { bakeHierarchy, bakeInto } from '../world/bake.js';

const A = ZONES.lalotaiArena;

function buildTamatoa() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: '#e8b84a', metalness: 0.85, roughness: 0.25, flatShading: true });
  const body = new THREE.Group();
  g.add(body);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.scale.set(1, 0.7, 1.1);
  shell.position.y = 5;
  shell.castShadow = true;
  body.add(shell);
  // 보석
  const gems = ['#ff4a8a', '#4af0ff', '#8aff4a', '#ffffff', '#b44aff'];
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4.8;
    const y = 5 + Math.sqrt(Math.max(0, 1 - (r / 6) ** 2)) * 4.1;
    part('sphere', mat(gems[i % gems.length], { metalness: 0.5, roughness: 0.1, emissive: gems[i % gems.length], emissiveIntensity: 0.25 }), 0.35, 0.35, 0.35, Math.cos(a) * r, y, Math.sin(a) * r * 1.1, body);
  }
  part('sphere', mat('#c2452a'), 5.8, 1.6, 6.3, 0, 4.9, 0, body);
  // 눈자루
  const eyes = [];
  for (const x of [-1.2, 1.2]) {
    const e = new THREE.Group();
    e.position.set(x, 5.5, 5.5);
    part('cyl', mat('#c2452a'), 0.25, 2.5, 0.25, 0, 1.2, 0, e);
    part('sphereSmooth', mat('#ffffff'), 0.7, 0.7, 0.7, 0, 2.6, 0, e);
    part('sphereSmooth', mat('#111111'), 0.35, 0.35, 0.3, 0, 2.65, 0.5, e);
    body.add(e);
    eyes.push(e);
  }
  // 다리
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const leg = new THREE.Group();
    leg.position.set(side * 5, 4.6, -3 + k * 2);
    const up = part('cyl', mat('#c2452a'), 0.35, 4, 0.35, side * 1.6, 0.6, 0, leg);
    up.rotation.z = side * 1.1;
    const low = part('cyl', mat('#a8381f'), 0.28, 5, 0.28, side * 3.5, -2, 0, leg);
    low.rotation.z = -side * 0.35;
    body.add(leg);
    legs.push(leg);
  }
  // 집게 (하나는 거대)
  const clawBig = new THREE.Group();
  clawBig.position.set(-4, 5, 5);
  part('sphere', mat('#c2452a'), 2.2, 1.6, 3, 0, 0, 2.5, clawBig);
  const jaw = part('sphere', mat('#a8381f'), 1.6, 0.8, 2.4, 0, -1.2, 3, clawBig);
  jaw.userData.keep = true;
  body.add(clawBig);
  const clawSmall = new THREE.Group();
  clawSmall.position.set(4, 5, 5);
  part('sphere', mat('#c2452a'), 1, 0.8, 1.4, 0, 0, 1.2, clawSmall);
  body.add(clawSmall);
  // 등에 붙은 마우이의 갈고리
  const hook = buildHook(2.2);
  hook.position.set(0, 8.6, -3.5);
  hook.rotation.set(-0.5, 0, 0.3);
  body.add(hook);
  g.userData = { body, legs, eyes, clawBig, jaw, hook };
  bakeHierarchy(g);
  return g;
}

export class Lalotai {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.visible = false;
    game.scene.add(this.group);
    this.build();
    this.tamatoa = { x: A.x, z: A.z - 30, yaw: 0, state: 'idle', timer: 0, lure: null, flipped: false };
    this.tMesh = buildTamatoa();
    this.group.add(this.tMesh);
    this.hookTaken = false;
    this.lures = [];
    this.geyserOn = false;
  }

  build() {
    const g = this.group;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(A.r + 60, 48), new THREE.MeshStandardMaterial({ color: '#2a2040', roughness: 0.9, flatShading: true }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(A.x, 0.02, A.z);
    floor.receiveShadow = true;
    g.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(A.r + 70, A.r + 5, 160, 40, 4, true), new THREE.MeshStandardMaterial({ color: '#1c1630', side: THREE.BackSide, flatShading: true, emissive: '#110a22' }));
    wall.position.set(A.x, 78, A.z);
    g.add(wall);
    // 빛나는 식물
    const glowCols = ['#3dffd0', '#ff4ad8', '#6a8cff', '#b0ff4a'];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * (A.r - 15);
      const x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
      const c = glowCols[i % glowCols.length];
      const h = 1 + Math.random() * 4;
      const p = part('cone', mat(c, { emissive: c, emissiveIntensity: 0.8 }), 0.3 + Math.random() * 0.5, h, 0.3, x, h / 2, z, g);
      p.rotation.z = (Math.random() - 0.5) * 0.4;
    }
    // 보물 더미
    const gold = mat('#ffcf4a', { metalness: 0.9, roughness: 0.2, emissive: '#6a4a00', emissiveIntensity: 0.3 });
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 18;
      part(i % 3 ? 'sphere' : 'cyl', gold, 0.6 + Math.random(), 0.3 + Math.random() * 0.6, 0.6 + Math.random(), A.x + Math.cos(a) * r, Math.random() * 3 * (1 - r / 18), A.z - 70 + Math.sin(a) * r * 0.6, g);
    }
    // 보라빛 조명
    const l1 = new THREE.PointLight('#b070ff', 400, 200, 1.2); l1.position.set(A.x, 40, A.z); g.add(l1);
    const l2 = new THREE.PointLight('#40ffd0', 200, 120, 1.4); l2.position.set(A.x - 50, 15, A.z + 30); g.add(l2);
    // 빛나는 이끼 (미끼 재료)
    this.algae = [];
    const spots = [[-55, 20], [55, 20], [-40, -40], [45, -45], [0, 55]];
    for (const [dx, dz] of spots) {
      const pos = new THREE.Vector3(A.x + dx, 0.2, A.z + dz);
      const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 12), new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.8 }));
      m.rotation.x = -Math.PI / 2;
      m.position.copy(pos);
      g.add(m);
      this.algae.push({ pos, mesh: m });
      this.game.addInteractable({
        pos, radius: 3.2, zone: 'lalotai',
        label: () => '✨ 빛나는 이끼로 반짝이 미끼 만들기',
        enabled: () => this.game.zone === 'lalotai' && !this.hookTaken,
        action: () => this.makeLure(pos),
      });
    }
    // 간헐천 (돌아가는 길)
    this.geyser = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    col.position.y = 20;
    this.geyser.add(col);
    this.geyser.position.set(A.x, 0, A.z + 95);
    this.geyser.visible = false;
    this.geyser.userData.dynamic = true;
    g.add(this.geyser);
    bakeInto(g);
    this.game.addInteractable({
      pos: this.geyser.position.clone(), radius: 5, zone: 'lalotai',
      label: () => '💨 간헐천에 뛰어들어 바다 위로 돌아가기',
      enabled: () => this.geyserOn && this.game.zone === 'lalotai',
      action: () => this.exit(),
    });
    // 갈고리 잡기
    this.game.addInteractable({
      pos: new THREE.Vector3(), radius: 6, zone: 'lalotai',
      getPos: () => this.hookWorld(),
      label: () => (['distracted', 'toLure'].includes(this.tamatoa.state) ? '🪝 갈고리 빼내기!' : '🪝 갈고리 (타마토아가 보고 있어요! 미끼 먼저)'),
      enabled: () => this.game.zone === 'lalotai' && !this.hookTaken,
      action: (who) => this.tryGrabHook(who),
    });
  }

  hookWorld() {
    const h = this.tMesh.userData.hook;
    return h.getWorldPosition(new THREE.Vector3()).setY(1);
  }
  hookTarget() {
    if (this.game.zone !== 'lalotai') return this.game.locations.spireBase;
    return this.hookTaken ? this.geyser.position : this.hookWorld();
  }

  enter() {
    const g = this.game;
    g.fadeTransition(() => {
      g.setZone('lalotai');
      this.group.visible = true;
      const spots = [new THREE.Vector3(A.x - 2, 0, A.z + 85), new THREE.Vector3(A.x + 2, 0, A.z + 87)];
      for (const [i, c] of g.characters.entries()) {
        if (c.state === 'helm') c.leaveHelm();
        if (c.form === 'hawk') c.toggleHawk();
        if (c.carrying) c.dropCarried();
        c.setWorld(spots[i]);
        c.pos.y = heightAt(c.pos.x, c.pos.z);
        c.state = 'ground';
        c.facing = Math.PI;
      }
      g.camRig.yaw = Math.PI;
      g.dialog.show(g.lines.lalotai, () => g.quests.advance('lalotai'));
    });
  }

  exit() {
    const g = this.game;
    g.fadeTransition(() => {
      g.setZone('surface');
      this.group.visible = false;
      const b = g.boat;
      const spots = { moana: new THREE.Vector3(0.8, 0, -1.4), maui: new THREE.Vector3(-1.2, 0, 3) };
      for (const c of g.characters) {
        c.state = 'ground';
        c.placeOnBoat(spots[c.kind].clone());
      }
      g.effects.splash(new THREE.Vector3(b.x, 1, b.z), 2);
      g.hud.toast('간헐천이 모두를 배 위로 쏘아 올렸어요! 💨');
      if (g.quests.is('tamatoa')) {
        g.quests.advance('tamatoa');
        g.dialog.show(g.lines.shapeshift);
      }
    });
  }

  makeLure(pos) {
    const g = this.game;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#b0ffd8', emissive: '#40ff90', emissiveIntensity: 1.5, metalness: 0.5 }));
    m.position.copy(pos).setY(1.2);
    this.group.add(m);
    const lure = { pos: pos.clone(), mesh: m, life: 14 };
    this.lures.push(lure);
    const T = this.tamatoa;
    if (!T.flipped) { T.state = 'toLure'; T.lure = lure; }
    g.audio.play('sparkle');
    g.effects.sparkle(m.position, 'spark', 20);
    g.hud.toast('✨ 반짝이 미끼! 타마토아가 한눈을 팔아요!');
  }

  tryGrabHook(who) {
    const g = this.game;
    const T = this.tamatoa;
    if (T.state !== 'distracted' && T.state !== 'toLure' && !T.flipped) {
      g.hud.toast('타마토아가 눈치챘어요! 먼저 빛나는 이끼로 미끼를 만들어요 ✨');
      T.state = 'chase';
      return;
    }
    this.hookTaken = true;
    this.tMesh.userData.hook.visible = false;
    g.maui.setHook(true);
    g.effects.sparkle(this.hookWorld().setY(5), 'gold', 40);
    g.audio.play('quest');
    T.flipped = true;
    T.state = 'flipped';
    this.geyserOn = true;
    this.geyser.visible = true;
    g.dialog.show(g.lines.gotHook);
    g.hud.toast(`${josa(who.name, '이', '가')} 갈고리를 되찾았어요! 🪝`);
  }

  update(dt, t) {
    if (this.game.zone !== 'lalotai') return;
    const g = this.game;
    const T = this.tamatoa;
    const u = this.tMesh.userData;
    for (let i = this.lures.length - 1; i >= 0; i--) {
      const l = this.lures[i];
      l.life -= dt;
      l.mesh.rotation.y += dt * 2;
      l.mesh.position.y = 1.2 + Math.sin(t * 3) * 0.3;
      if (l.life <= 0) {
        this.group.remove(l.mesh);
        this.lures.splice(i, 1);
        if (T.lure === l) { T.lure = null; if (!T.flipped) { T.state = 'chase'; } }
      }
    }
    let speed = 0;
    let wantYaw = T.yaw;
    const lead = g.leader.worldPos(new THREE.Vector3());
    if (T.state === 'idle') {
      T.timer += dt;
      if (Math.hypot(lead.x - T.x, lead.z - T.z) < 60 || T.timer > 8) T.state = 'chase';
    }
    if (T.state === 'chase') {
      // 가장 가까운 캐릭터를 쫓는다
      let best = null, bd = Infinity;
      for (const c of g.characters) {
        const p = c.worldPos(new THREE.Vector3());
        const d = Math.hypot(p.x - T.x, p.z - T.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        wantYaw = Math.atan2(best.x - T.x, best.z - T.z);
        speed = bd > 9 ? 3.6 : 0;
      }
    } else if (T.state === 'toLure' && T.lure) {
      const d = Math.hypot(T.lure.pos.x - T.x, T.lure.pos.z - T.z);
      wantYaw = Math.atan2(T.lure.pos.x - T.x, T.lure.pos.z - T.z);
      speed = 9;
      if (d < 22) T.state = 'distracted';
    } else if (T.state === 'distracted' && T.lure) {
      wantYaw = Math.atan2(T.lure.pos.x - T.x, T.lure.pos.z - T.z);
    }
    T.yaw = approachAngle(T.yaw, wantYaw, dt * 1.5);
    T.x += Math.sin(T.yaw) * speed * dt;
    T.z += Math.cos(T.yaw) * speed * dt;
    const dA = Math.hypot(T.x - A.x, T.z - A.z);
    if (dA > A.r - 12) { T.x = A.x + ((T.x - A.x) / dA) * (A.r - 12); T.z = A.z + ((T.z - A.z) / dA) * (A.r - 12); }
    this.tMesh.position.set(T.x, 0, T.z);
    this.tMesh.rotation.y = T.yaw;
    // 뒤집힌 타마토아
    u.body.rotation.z += ((T.flipped ? Math.PI : 0) - u.body.rotation.z) * dt * 2;
    u.body.position.y += ((T.flipped ? 9 : 0) - u.body.position.y) * dt * 2;
    u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * (speed > 0 ? 8 : 1.5) + i) * (T.flipped ? 0.6 : speed > 0 ? 0.35 : 0.08); });
    u.eyes.forEach((e, i) => { e.rotation.z = Math.sin(t * 1.3 + i) * 0.2; });
    u.clawBig.rotation.x = Math.sin(t * 2) * 0.15;
    u.jaw.rotation.x = Math.max(0, Math.sin(t * 4)) * 0.3;
    // 몸통 박치기
    if (!T.flipped && T.state === 'chase') {
      for (const c of g.characters) {
        const p = c.worldPos(new THREE.Vector3());
        if (Math.hypot(p.x - T.x, p.z - T.z) < 9) c.damage(1, new THREE.Vector3(T.x, 0, T.z));
      }
    }
    if (this.geyser.visible) {
      this.geyser.children[0].scale.set(1 + Math.sin(t * 8) * 0.1, 1, 1 + Math.cos(t * 7) * 0.1);
      if (Math.random() < 0.3) g.effects.sparkle(this.geyser.position.clone().setY(2 + Math.random() * 30), 'splash', 1);
    }
  }
}
