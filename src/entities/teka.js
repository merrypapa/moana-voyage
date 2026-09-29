// 테 카 (용암 악마) → 테 피티 (생명의 여신)
import * as THREE from 'three';
import { ISLANDS } from '../config.js';
import { mat, part } from './models.js';
import { lavaCrackTexture, heartTexture } from '../textures.js';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { restoreBlight } from '../world/world.js';
import { approachAngle, clamp } from '../util.js';
import { bakeInto } from '../world/bake.js';

const TF = ISLANDS.find((i) => i.id === 'tefiti');

function buildTeKa() {
  const g = new THREE.Group();
  const crack = lavaCrackTexture();
  crack.repeat.set(2, 2);
  const rock = new THREE.MeshStandardMaterial({ color: '#241a16', emissive: '#ff5a10', emissiveMap: crack, emissiveIntensity: 1.6, flatShading: true, roughness: 1 });
  const body = new THREE.Group();
  g.add(body);
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(9, 1), rock);
  torso.scale.set(1.1, 1.5, 0.8);
  torso.position.y = 30;
  body.add(torso);
  const hips = new THREE.Mesh(new THREE.DodecahedronGeometry(7, 0), rock);
  hips.position.y = 16;
  body.add(hips);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(5, 1), rock);
  head.position.y = 47;
  body.add(head);
  // 불타는 눈
  for (const x of [-1.8, 1.8]) part('sphere', new THREE.MeshBasicMaterial({ color: '#ffe060' }), 0.9, 0.5, 0.4, x, 47.5, 4.6, body);
  // 불꽃 머리카락
  const flames = [];
  const fireMat = new THREE.MeshBasicMaterial({ color: '#ff7a20', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7 + Math.random() * 5, 6), fireMat);
    f.position.set(Math.cos(a) * 3.5, 52, Math.sin(a) * 3.5 - 1);
    f.rotation.set(Math.sin(a) * 0.4 - 0.3, 0, -Math.cos(a) * 0.4);
    body.add(f);
    flames.push(f);
  }
  // 가슴의 나선 (심장 자리)
  const spiralSpot = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), new THREE.MeshStandardMaterial({ map: heartTexture(), emissive: '#2fd39a', emissiveIntensity: 0.3, transparent: true, opacity: 0.8 }));
  spiralSpot.position.set(0, 32, 7.3);
  body.add(spiralSpot);
  // 팔
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 11, 38, 0);
    const up = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 0), rock);
    up.scale.set(1, 2.4, 1); up.position.y = -7;
    arm.add(up);
    const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 0), rock);
    hand.position.y = -16;
    arm.add(hand);
    body.add(arm);
    arms.push(arm);
  }
  // 다리
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.DodecahedronGeometry(4, 0), rock);
    leg.scale.set(1, 2.2, 1);
    leg.position.set(side * 5, 7, 0);
    body.add(leg);
  }
  const light = new THREE.PointLight('#ff6a20', 800, 260, 1.3);
  light.position.set(0, 35, 12);
  body.add(light);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { body, arms, flames, spiralSpot, light, rock };
  return g;
}

function buildTeFiti() {
  // 누워 있는 초록 여신 (섬의 모습)
  const g = new THREE.Group();
  const green = mat('#3f9a4a'), dark = mat('#2d7a3a'), skin = mat('#4fae5a');
  part('sphere', skin, 7, 6, 7, 0, 6, 26, g);
  const hair = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    hair.push(part('sphere', i % 2 ? green : dark, 3.6, 3, 3.6, Math.cos(a) * 7, 6 + Math.sin(a) * 4, 26 + Math.sin(a) * 6 - 4, g));
  }
  part('sphere', green, 12, 7, 16, 0, 4, 4, g);
  part('sphere', dark, 9, 5, 14, 0, 2.5, -20, g);
  const flowers = ['#ff6fa8', '#ffd24a', '#ff8a4a', '#ffffff', '#c47aff'];
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 22, z = -30 + Math.random() * 62;
    part('sphere', mat(flowers[i % flowers.length], { emissive: flowers[i % flowers.length], emissiveIntensity: 0.2 }), 0.7, 0.5, 0.7, x, 5 + Math.random() * 6, z, g);
  }
  // 얼굴 (감은 눈, 미소)
  for (const x of [-2.2, 2.2]) part('box', mat('#1d4a24'), 1.6, 0.25, 0.3, x, 7.5, 32.8, g);
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ map: heartTexture(), emissive: '#2fd39a', emissiveIntensity: 1.5 }));
  heart.position.set(0, 11, 8);
  g.add(heart);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  bakeInto(g);
  return g;
}

export class TeKa {
  constructor(game) {
    this.game = game;
    this.mesh = buildTeKa();
    this.mesh.visible = false;
    game.scene.add(this.mesh);
    this.pos = new THREE.Vector3(TF.x, 0, TF.z - 120);
    this.state = 'dormant'; // dormant → rising → attack → approach → kneel → restored
    this.rise = 0;
    this.attackT = 3;
    this.bombs = [];
    this.throwAnim = 0;
    this.yaw = 0;
    this.teFiti = buildTeFiti();
    this.teFiti.position.set(TF.x - 10, heightAt(TF.x - 10, TF.z + 20) - 1, TF.z + 20);
    this.teFiti.rotation.y = 0.4;
    this.teFiti.visible = false;
    game.scene.add(this.teFiti);
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    this.bombGeo = new THREE.DodecahedronGeometry(2.2, 0);
    this.bombMat = new THREE.MeshBasicMaterial({ color: '#ff6a1a' });
    this.heartFly = null;
    game.addInteractable({
      pos: new THREE.Vector3(), radius: 70, onlyKind: 'moana', priority: 5,
      getPos: () => this.pos,
      label: () => '💚 테 카에게 심장 돌려주기',
      enabled: () => this.state === 'kneel' && game.quests.is('restore'),
      action: (who) => this.giveHeart(who),
    });
  }

  awaken() {
    if (this.state !== 'dormant') return;
    this.state = 'rising';
    this.rise = 0;
    this.mesh.visible = true;
    this.game.audio.play('rumble');
    this.game.effects.shake = 1.5;
    this.game.dialog.show(this.game.lines.tekaAwake);
  }

  target() {
    const g = this.game;
    // 마우이가 매로 가까이 날면 마우이를 노린다 (주의 끌기)
    const m = g.maui;
    if (m.form === 'hawk') {
      const mp = m.worldPos(new THREE.Vector3());
      if (mp.distanceTo(this.pos.clone().setY(40)) < 90) return { pos: mp, who: m };
    }
    const b = g.boat;
    if (g.moana.onBoat) {
      const lead = 1.4;
      return { pos: new THREE.Vector3(b.x + Math.sin(b.yaw) * b.speed * lead, 0, b.z + Math.cos(b.yaw) * b.speed * lead), who: null };
    }
    return { pos: g.moana.worldPos(new THREE.Vector3()), who: g.moana };
  }

  throwBomb() {
    const tg = this.target();
    const u = this.mesh.userData;
    const hand = u.arms[this.bombs.length % 2].children[1].getWorldPosition(new THREE.Vector3());
    const to = tg.pos.clone();
    to.x += (Math.random() - 0.5) * 22; to.z += (Math.random() - 0.5) * 22;
    to.y = Math.max(heightAt(to.x, to.z), 0);
    const m = new THREE.Mesh(this.bombGeo, this.bombMat);
    m.position.copy(hand);
    const ring = new THREE.Mesh(new THREE.RingGeometry(5, 7, 24), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(to).setY(to.y + 0.6);
    this.game.scene.add(m, ring);
    this.bombs.push({ m, ring, from: hand, to, t: 0, dur: 2.2 });
    this.throwAnim = 1;
    this.game.audio.play('whoosh');
  }

  giveHeart(who) {
    const g = this.game;
    this.state = 'restoring';
    const start = who.worldPos(new THREE.Vector3()).setY(who.worldPos().y + 1.4);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ map: heartTexture(), emissive: '#2fd39a', emissiveIntensity: 2 }));
    m.position.copy(start);
    g.scene.add(m);
    g.moana.model.heart.visible = false;
    this.heartFly = { m, start, t: 0 };
    g.audio.play('sparkle');
  }

  finishRestore() {
    const g = this.game;
    this.state = 'restored';
    this.mesh.visible = false;
    this.teFiti.visible = true;
    g.effects.leaves(this.pos.clone().setY(30), 80);
    g.effects.flash('rgba(120,255,160,0.6)');
    restoreBlight(g);
    g.flags.restored = true;
    for (const b of this.bombs) g.scene.remove(b.m, b.ring);
    this.bombs = [];
    g.audio.play('restore');
    g.showBigText('테 피티가 돌아왔어요!', '생명이 다시 피어나요 🌺');
    g.dialog.show(g.lines.restored, () => g.quests.advance('restore'));
  }

  update(dt, t) {
    const g = this.game;
    const u = this.mesh.userData;
    if (this.state === 'dormant' || this.state === 'restored') {
      return;
    }
    u.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i) * 0.25; });
    u.light.intensity = 700 + Math.sin(t * 12) * 150;
    if (this.state === 'rising') {
      this.rise = Math.min(1, this.rise + dt / 4);
      this.pos.y = -55 + 55 * this.rise;
      if (Math.random() < 0.5) g.effects.explode(this.pos.clone().setY(2 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30)), 0.6);
      if (this.rise >= 1) this.state = 'attack';
    }
    const lead = g.moana.worldPos(new THREE.Vector3());
    if (this.state === 'attack') {
      const tg = this.target();
      this.yaw = approachAngle(this.yaw, Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z), dt * 1.2);
      this.attackT -= dt;
      if (this.attackT <= 0) {
        this.attackT = 2.6 + Math.random() * 1.8;
        this.throwBomb();
      }
      // 모아나가 방벽 안으로 들어오면 정체를 깨닫는다
      if (g.quests.is('teka') && Math.hypot(lead.x - TF.x, lead.z - TF.z) < 330) {
        g.quests.advance('teka');
      }
    }
    if (this.state === 'approach' || this.state === 'kneel') {
      const d = Math.hypot(lead.x - this.pos.x, lead.z - this.pos.z);
      this.yaw = approachAngle(this.yaw, Math.atan2(lead.x - this.pos.x, lead.z - this.pos.z), dt);
      if (this.state === 'approach') {
        if (d > 45) {
          const sp = Math.min(18, 6 + d * 0.05);
          this.pos.x += Math.sin(this.yaw) * sp * dt;
          this.pos.z += Math.cos(this.yaw) * sp * dt;
          if (Math.random() < 0.2) g.effects.emit('smoke', this.pos.clone().setY(2), 2, { speed: 3, up: 5, size: 3, life: 2, gravity: -1 });
        } else this.state = 'kneel';
      }
      u.spiralSpot.material.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.6;
    }
    // 무릎 꿇기
    const kneel = this.state === 'kneel' || this.state === 'restoring';
    u.body.position.y += ((kneel ? -14 : 0) - u.body.position.y) * dt * 1.5;
    u.body.rotation.x += ((kneel ? 0.35 : 0) - u.body.rotation.x) * dt * 1.5;
    // 던지기 팔 동작
    if (this.throwAnim > 0) this.throwAnim = Math.max(0, this.throwAnim - dt * 1.5);
    u.arms[0].rotation.x = -this.throwAnim * 2.5 + Math.sin(t) * 0.1;
    u.arms[1].rotation.x = this.state === 'kneel' ? -0.8 : Math.sin(t * 0.8) * 0.15;
    const ground = Math.max(0, heightAt(this.pos.x, this.pos.z)) - 2;
    this.mesh.position.set(this.pos.x, Math.min(this.pos.y, 0) + ground, this.pos.z);
    this.mesh.rotation.y = this.yaw;

    // 불덩이
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t += dt / b.dur;
      const k = Math.min(1, b.t);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(k * Math.PI) * 60;
      b.m.rotation.x += dt * 5;
      b.ring.material.opacity = 0.3 + k * 0.5;
      b.ring.scale.setScalar(1.3 - k * 0.4);
      if (k >= 1) {
        g.effects.explode(b.to.clone().setY(b.to.y + 1), 1);
        g.audio.play('boom');
        const surf = waveHeight(b.to.x, b.to.z, t);
        if (b.to.y <= surf) g.effects.splash(b.to.clone().setY(surf), 2);
        for (const c of g.characters) {
          const p = c.worldPos(new THREE.Vector3());
          if (Math.hypot(p.x - b.to.x, p.z - b.to.z) < 6.5 && Math.abs(p.y - b.to.y) < 12) c.damage(1, b.to);
        }
        const bb = g.boat;
        const dB = Math.hypot(bb.x - b.to.x, bb.z - b.to.z);
        if (dB < 12) { bb.speed *= 0.5; g.effects.shake = 0.8; }
        g.scene.remove(b.m, b.ring);
        this.bombs.splice(i, 1);
      }
    }
    // 심장이 날아가는 연출
    if (this.heartFly) {
      const h = this.heartFly;
      h.t += dt / 2.5;
      const k = Math.min(1, h.t);
      const dst = u.spiralSpot.getWorldPosition(new THREE.Vector3());
      h.m.position.lerpVectors(h.start, dst, k);
      h.m.position.y += Math.sin(k * Math.PI) * 10;
      h.m.rotation.y += dt * 4;
      if (Math.random() < 0.6) g.effects.sparkle(h.m.position.clone(), 'spark', 2);
      if (k >= 1) {
        g.scene.remove(h.m);
        this.heartFly = null;
        this.finishRestore();
      }
    }
  }

  // ---------- 2인 플레이 ----------
  netState() {
    const r = (v) => Math.round(v * 10) / 10;
    const bombs = this.bombs.map((b) => [r(b.from.x), r(b.from.y), r(b.from.z), r(b.to.x), r(b.to.y), r(b.to.z), Math.round(b.t * 100) / 100]);
    const h = this.heartFly ? [Math.round(this.heartFly.t * 100) / 100, r(this.heartFly.start.x), r(this.heartFly.start.y), r(this.heartFly.start.z)] : 0;
    return [this.state, r(this.pos.x), r(this.pos.y), r(this.pos.z), Math.round(this.yaw * 100) / 100, Math.round(this.throwAnim * 100) / 100, bombs, h];
  }
  netApply(d) {
    const [state, x, y, z, yaw, ta, bombs, h] = d;
    const g = this.game;
    this.state = state;
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.throwAnim = ta;
    this.mesh.visible = !['dormant', 'restored'].includes(state);
    this.teFiti.visible = state === 'restored';
    if (state === 'restored' && !g.flags.restoredApplied) { g.flags.restoredApplied = true; restoreBlight(g); }
    // 불덩이
    while (this.bombs.length > bombs.length) { const b = this.bombs.pop(); g.scene.remove(b.m, b.ring); }
    while (this.bombs.length < bombs.length) {
      const m = new THREE.Mesh(this.bombGeo, this.bombMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(5, 7, 24), this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      g.scene.add(m, ring);
      this.bombs.push({ m, ring, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0 });
    }
    bombs.forEach((bd, i) => {
      const b = this.bombs[i];
      b.from.set(bd[0], bd[1], bd[2]); b.to.set(bd[3], bd[4], bd[5]); b.t = bd[6];
    });
    // 심장이 날아가는 모습
    if (h && !this.heartFly) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ map: heartTexture(), emissive: '#2fd39a', emissiveIntensity: 2 }));
      g.scene.add(m);
      this.heartFly = { m, start: new THREE.Vector3(h[1], h[2], h[3]), t: h[0] };
    } else if (h) this.heartFly.t = h[0];
    else if (this.heartFly) { g.scene.remove(this.heartFly.m); this.heartFly = null; }
  }
  netVisual(dt, t) {
    const u = this.mesh.userData;
    if (!this.mesh.visible) return;
    u.flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i) * 0.25; });
    u.light.intensity = 700 + Math.sin(t * 12) * 150;
    const kneel = this.state === 'kneel' || this.state === 'restoring';
    u.body.position.y += ((kneel ? -14 : 0) - u.body.position.y) * dt * 1.5;
    u.body.rotation.x += ((kneel ? 0.35 : 0) - u.body.rotation.x) * dt * 1.5;
    u.arms[0].rotation.x = -this.throwAnim * 2.5 + Math.sin(t) * 0.1;
    u.arms[1].rotation.x = this.state === 'kneel' ? -0.8 : Math.sin(t * 0.8) * 0.15;
    if (this.state === 'approach' || kneel) u.spiralSpot.material.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.6;
    const ground = Math.max(0, heightAt(this.pos.x, this.pos.z)) - 2;
    this.mesh.position.set(this.pos.x, Math.min(this.pos.y, 0) + ground, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    for (const b of this.bombs) {
      const k = Math.min(1, b.t);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(k * Math.PI) * 60;
      b.ring.position.copy(b.to).setY(b.to.y + 0.6);
      b.ring.material.opacity = 0.3 + k * 0.5;
      b.ring.scale.setScalar(1.3 - k * 0.4);
    }
    if (this.heartFly) {
      const hf = this.heartFly;
      const k = Math.min(1, hf.t);
      const dst = u.spiralSpot.getWorldPosition(new THREE.Vector3());
      hf.m.position.lerpVectors(hf.start, dst, k);
      hf.m.position.y += Math.sin(k * Math.PI) * 10;
    }
  }

  startReveal() {
    this.state = 'approach';
    for (const b of this.bombs) this.game.scene.remove(b.m, b.ring);
    this.bombs = [];
    this.game.dialog.show(this.game.lines.tekaReveal);
  }
}

export { TF };
