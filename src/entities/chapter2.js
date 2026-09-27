// 2장: 거대 조개, 마탕기, 날로의 폭풍, 모투페투
import * as THREE from 'three';
import { ISLANDS, ZONES } from '../config.js';
import { mat, part, humanoid } from './models.js';
import { heightAt, islandHeight } from '../world/terrain.js';
import { storm, waveHeight } from '../world/ocean.js';
import { smoothstep, clamp } from '../util.js';
import { bakeHierarchy, bakeInto } from '../world/bake.js';

const MATANGI = ISLANDS.find((i) => i.id === 'matangi');
const MOTUFETU = ISLANDS.find((i) => i.id === 'motufetu');

function buildClam() {
  const g = new THREE.Group();
  const shellMat = mat('#c9a0d8', { roughness: 0.6 });
  const lower = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shellMat);
  lower.scale.set(1, 0.4, 1);
  g.add(lower);
  const upper = new THREE.Group();
  const up = new THREE.Mesh(new THREE.SphereGeometry(18, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  up.scale.set(1, 0.45, 1);
  up.position.z = 18;
  upper.add(up);
  upper.position.z = -18;
  g.add(upper);
  // 물결 무늬 골
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI - Math.PI / 2;
    const r = part('box', mat('#a878bc'), 0.8, 0.8, 17, Math.sin(a) * 8, 7.5, 18 + Math.cos(a) * 8 - 18, upper);
    r.rotation.y = a;
  }
  part('sphere', mat('#ff8aa8'), 15, 3, 15, 0, 0.5, 0, g);
  const pearl = part('sphereSmooth', mat('#ffffff', { metalness: 0.4, roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.3 }), 3, 3, 3, 0, 3.5, 0, g);
  g.userData = { upper, pearl };
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  bakeHierarchy(g);
  return g;
}

function buildMatangi() {
  const p = humanoid({ height: 2.0, width: 1.0, skin: '#8a6ab0', top: '#3a1f55', skirt: '#2a1a40' });
  const hair = mat('#1a0f2a');
  part('sphere', hair, p.headR * 1.3, p.headR * 1.5, p.headR * 1.3, 0, p.headR * 0.4, -p.headR * 0.3, p.head);
  // 박쥐 날개
  for (const side of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, side * 2.4, 0.9, -0.2, side * 1.8, -0.5, -0.2, 0, 0, 0, side * 1.8, -0.5, -0.2, side * 1.1, -1.2, -0.1, 0, 0, 0, side * 1.1, -1.2, -0.1, side * 0.3, -1.4, 0], 3));
    geo.computeVertexNormals();
    const w = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#2a1540', side: THREE.DoubleSide, flatShading: true }));
    w.position.set(side * 0.15, p.shY, -0.2);
    w.userData.keep = true;
    p.body.add(w);
    p['wing' + side] = w;
  }
  // 빛나는 눈
  p.head.traverse((c) => { if (c.isMesh && c.material.color && c.material.color.getHexString() === '1a1410') c.material = mat('#ff4ad8', { emissive: '#ff4ad8', emissiveIntensity: 1 }); });
  bakeHierarchy(p.root);
  return p;
}

export class Chapter2 {
  constructor(game) {
    this.game = game;
    // 거대 조개
    this.clam = buildClam();
    const C = ZONES.clam;
    this.clam.position.set(C.x, -3, C.z);
    game.scene.add(this.clam);
    this.whirl = new THREE.Group();
    const foam = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(30 + i * 26, 33 + i * 26, 48, 1, 0, Math.PI * 1.4), foam);
      r.rotation.x = -Math.PI / 2;
      r.rotation.z = i;
      r.position.y = 0.4;
      this.whirl.add(r);
    }
    this.whirl.position.set(C.x, 0, C.z);
    this.whirl.visible = false;
    game.scene.add(this.whirl);
    this.clamActive = false;
    this.clamStun = 0;
    this.clamDone = false;

    // 마탕기
    this.matangi = buildMatangi();
    let best = { x: MATANGI.x, z: MATANGI.z + 60, h: 0 };
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const x = MATANGI.x + Math.sin(a) * 110, z = MATANGI.z + Math.cos(a) * 110;
      const h = heightAt(x, z);
      if (h > 2 && h < 10 && Math.cos(a) > 0.2) { best = { x, z, h }; break; }
    }
    this.matangiPos = new THREE.Vector3(best.x, heightAt(best.x, best.z), best.z);
    this.matangi.root.position.copy(this.matangiPos);
    this.matangi.root.rotation.y = Math.atan2(MATANGI.x - best.x, MATANGI.z - best.z) + Math.PI;
    game.scene.add(this.matangi.root);
    // 박쥐 날개 바위 + 빛나는 덩굴
    const decor = new THREE.Group();
    game.scene.add(decor);
    for (const side of [-1, 1]) {
      const rock = part('cone', mat('#2a2233'), 8, 40, 3, MATANGI.x + side * 30, heightAt(MATANGI.x, MATANGI.z) + 30, MATANGI.z - 20, decor);
      rock.rotation.z = side * 0.6;
    }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 120;
      const x = MATANGI.x + Math.sin(a) * r, z = MATANGI.z + Math.cos(a) * r;
      const h = heightAt(x, z);
      if (h < 1) continue;
      const v = part('cyl', mat('#6a3aa0', { emissive: '#b04aff', emissiveIntensity: 0.6 }), 0.15, 3 + Math.random() * 4, 0.15, x, h + 2, z, decor);
      v.rotation.z = (Math.random() - 0.5) * 0.8;
    }
    bakeInto(decor);
    game.addInteractable({
      pos: this.matangiPos.clone(), radius: 5,
      label: () => '🦇 마탕기와 이야기하기',
      action: () => game.talkMatangi(),
    });
    // 빛나는 꽃 3송이
    this.flowers = [];
    for (const a of [0.4, 2.3, 4.2]) {
      // 해당 방향에서 바다에 잠기지 않은 가장 바깥쪽 땅
      let x = MATANGI.x, z = MATANGI.z;
      for (let r = 120; r > 20; r -= 3) {
        const px = MATANGI.x + Math.sin(a) * r, pz = MATANGI.z + Math.cos(a) * r;
        if (heightAt(px, pz) > 3) { x = MATANGI.x + Math.sin(a) * (r - 8); z = MATANGI.z + Math.cos(a) * (r - 8); break; }
      }
      const pos = new THREE.Vector3(x, heightAt(x, z), z);
      const f = new THREE.Group();
      part('cyl', mat('#2f7a34'), 0.06, 1, 0.06, 0, 0.5, 0, f);
      for (let k = 0; k < 6; k++) {
        const pa = (k / 6) * Math.PI * 2;
        part('sphere', mat('#ff6ae8', { emissive: '#ff4ad8', emissiveIntensity: 1.2 }), 0.25, 0.08, 0.45, Math.cos(pa) * 0.3, 1.05, Math.sin(pa) * 0.3, f).rotation.y = -pa;
      }
      const light = new THREE.PointLight('#ff4ad8', 20, 12, 1.5);
      light.position.y = 1.5;
      f.add(light);
      f.position.copy(pos);
      f.visible = false;
      game.scene.add(f);
      const flower = { pos, mesh: f, taken: false };
      this.flowers.push(flower);
      game.addInteractable({
        pos, radius: 2.5,
        label: () => '🌸 빛나는 꽃 줍기',
        enabled: () => f.visible && !flower.taken,
        action: () => {
          flower.taken = true;
          f.visible = false;
          game.effects.sparkle(pos.clone().setY(pos.y + 1), 'spark', 20);
          game.audio.play('sparkle');
          const n = this.flowers.filter((q) => q.taken).length;
          game.hud.toast(`🌸 빛나는 꽃 ${n}/3`);
          if (n >= 3) game.quests.advance('flowers');
        },
      });
    }

    // 날로의 폭풍
    const S = ZONES.storm;
    const wallMat = new THREE.MeshBasicMaterial({ color: '#2a3040', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    this.stormWall = new THREE.Mesh(new THREE.CylinderGeometry(S.r * 0.9, S.r, 500, 48, 1, true), wallMat);
    this.stormWall.position.set(S.x, 200, S.z);
    game.scene.add(this.stormWall);
    this.stormCloud = new THREE.Mesh(new THREE.CircleGeometry(S.r * 1.05, 48), new THREE.MeshBasicMaterial({ color: '#1e2430', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.stormCloud.rotation.x = Math.PI / 2;
    this.stormCloud.position.set(S.x, 180, S.z);
    game.scene.add(this.stormCloud);
    this.strikes = [];
    this.strikeT = 2;
    this.boltMat = new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true });
    this.warnMat = new THREE.MeshBasicMaterial({ color: '#ffe84a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    this.stormCleared = false;
    this.rain = null;
    this.buildRain();

    // 모투페투 끌어올리기
    this.pulls = 0;
    this.rising = 0;
    this.risen = false;
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(40, 1.2, 8, 48), new THREE.MeshBasicMaterial({ color: '#7cf5ff', transparent: true, opacity: 0.7 }));
    this.marker.rotation.x = Math.PI / 2;
    this.marker.position.set(S.x, 0.8, S.z);
    this.marker.visible = false;
    game.scene.add(this.marker);
    game.events.on('melee', (e) => this.onMelee(e));
  }

  buildRain() {
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 120; pos[i * 3 + 1] = Math.random() * 60; pos[i * 3 + 2] = (Math.random() - 0.5) * 120; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: '#b8d8ff', size: 0.25, transparent: true, opacity: 0.7 }));
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.game.scene.add(this.rain);
  }

  nearestFlower(p) {
    let best = null, bd = Infinity;
    for (const f of this.flowers) {
      if (f.taken) continue;
      const d = f.pos.distanceTo(p);
      if (d < bd) { bd = d; best = f.pos; }
    }
    return best || this.matangiPos;
  }

  showFlowers() { for (const f of this.flowers) if (!f.taken) f.mesh.visible = true; }

  onMelee(e) {
    const g = this.game;
    const C = ZONES.clam;
    if (e.who.kind === 'maui' && this.clamActive && Math.hypot(e.pos.x - C.x, e.pos.z - C.z) < 60) {
      this.clamStun = 6;
      g.effects.explode(new THREE.Vector3(C.x, 4, C.z), 0.8);
      g.hud.toast('💥 마우이가 조개를 때렸어요! 소용돌이가 잠깐 멈춰요!');
    }
    const S = ZONES.storm;
    if (g.quests.is('raise') && e.who.kind === 'maui' && e.who.hasHook && Math.hypot(e.pos.x - S.x, e.pos.z - S.z) < 180) {
      this.pulls++;
      g.effects.shake = 1;
      g.audio.play('rumble');
      g.effects.splash(new THREE.Vector3(S.x + (Math.random() - 0.5) * 30, 1, S.z + (Math.random() - 0.5) * 30), 2.5);
      g.hud.toast(`🪝 영차! (${Math.min(this.pulls, 5)}/5)`);
      if (this.pulls >= 5) this.startRise();
    } else if (g.quests.is('raise') && e.who.kind === 'maui') {
      g.hud.toast('빛나는 고리 가까이에서 갈고리를 써요!');
    }
  }

  startRise() {
    const g = this.game;
    if (this.rising > 0 || this.risen) return;
    this.rising = 0.001;
    this.marker.visible = false;
    // 배를 섬 바깥으로 밀어낸다
    const b = g.boat;
    const S = ZONES.storm;
    let dx = b.x - S.x, dz = b.z - S.z;
    const L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    const R = MOTUFETU.radius + 50;
    if (L < R) {
      b.x = S.x + dx * R; b.z = S.z + dz * R;
      b.yaw = Math.atan2(-dx, -dz);
      b.speed = 0; b.throttle = 0;
      g.hud.toast('파도가 배를 안전한 곳으로 밀어냈어요 🌊');
    }
    for (const c of g.characters) {
      if (!c.onBoat && c.form !== 'hawk') c.placeOnBoat(new THREE.Vector3(c.kind === 'maui' ? -1.2 : 0.8, 0, c.kind === 'maui' ? 3 : -1.4));
      if (c.form === 'hawk') c.pos.y = Math.max(c.pos.y, 80);
    }
    g.audio.play('restore');
  }

  update(dt, t) {
    const g = this.game;
    const b = g.boat;
    const q = g.quests;
    const clamPhase = q.is('clam');
    // ----- 조개 -----
    const C = ZONES.clam;
    const cu = this.clam.userData;
    cu.upper.rotation.x = -0.25 - Math.max(0, Math.sin(t * 0.8)) * 0.5;
    const dC = Math.hypot(b.x - C.x, b.z - C.z);
    if (clamPhase && !this.clamActive && dC < C.r + 30) {
      this.clamActive = true;
      this.whirl.visible = true;
      g.dialog.show(g.lines.clamStart);
    }
    if (this.clamActive) {
      this.whirl.rotation.y += dt * (this.clamStun > 0 ? 0.2 : 1.2);
      if (this.clamStun > 0) this.clamStun -= dt;
      else if (dC < 180 && dC > 1) {
        // 소용돌이: 안쪽 + 회전 방향으로 끌어당김
        const pull = 8 * smoothstep(180, 30, dC) + 2;
        const nx = (C.x - b.x) / dC, nz = (C.z - b.z) / dC;
        b.x += (nx * pull + -nz * pull * 0.8) * dt;
        b.z += (nz * pull + nx * pull * 0.8) * dt;
        if (dC < 22) {
          // 꿀꺽! …퉤!
          b.x = C.x - nx * 70; b.z = C.z - nz * 70;
          g.effects.splash(new THREE.Vector3(b.x, 1, b.z), 3);
          for (const c of g.characters) if (c.onBoat) c.damage(1);
          g.hud.toast('😵 조개가 배를 삼켰다가 뱉어냈어요!');
        }
      }
      if (clamPhase && dC > 230) {
        this.clamActive = false;
        this.whirl.visible = false;
        this.clamDone = true;
        g.dialog.show(g.lines.clamDone, () => q.advance('clam'));
      }
    }

    // ----- 마탕기 -----
    const mt = this.matangi;
    mt.root.visible = q.atLeast('clam');
    mt['wing-1'].rotation.y = Math.sin(t * 2) * 0.3;
    mt['wing1'].rotation.y = -Math.sin(t * 2) * 0.3;
    mt.body.position.y = Math.sin(t * 1.5) * 0.1;
    if (q.is('flowers')) this.showFlowers();
    for (const f of this.flowers) if (f.mesh.visible) f.mesh.rotation.y += dt;

    // ----- 폭풍 -----
    const S = ZONES.storm;
    const lead = g.leader.worldPos(new THREE.Vector3());
    const dS = Math.hypot(lead.x - S.x, lead.z - S.z);
    const stormOn = !this.stormCleared;
    storm.x = S.x; storm.z = S.z; storm.r = S.r;
    const targetAmt = stormOn ? smoothstep(S.r + 400, S.r * 0.6, dS) : 0;
    storm.amount += (targetAmt - storm.amount) * Math.min(1, dt * 0.8);
    g.stormAmount = storm.amount;
    this.stormWall.visible = stormOn;
    this.stormCloud.visible = stormOn;
    this.stormWall.rotation.y += dt * 0.05;
    this.rain.visible = storm.amount > 0.2;
    if (this.rain.visible) {
      this.rain.position.set(lead.x, lead.y - 10, lead.z);
      const p = this.rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 40;
        if (y < 0) y += 60;
        p.setY(i, y);
      }
      p.needsUpdate = true;
      this.rain.material.opacity = storm.amount * 0.8;
    }
    // 번개
    const lightningZone = stormOn && dS < S.r && (q.is('storm') || q.is('raise'));
    if (lightningZone) {
      this.strikeT -= dt;
      if (this.strikeT <= 0) {
        this.strikeT = 1.2 + Math.random() * 1.6;
        const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 40;
        const pos = new THREE.Vector3(b.x + Math.sin(a) * r, 0, b.z + Math.cos(a) * r);
        const warn = new THREE.Mesh(new THREE.RingGeometry(4, 6, 20), this.warnMat);
        warn.rotation.x = -Math.PI / 2;
        warn.position.copy(pos).setY(1);
        g.scene.add(warn);
        this.strikes.push({ pos, warn, t: 0, bolt: null });
      }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      s.warn.material.opacity = 0.3 + Math.abs(Math.sin(s.t * 12)) * 0.5;
      if (s.t > 1.3 && !s.bolt) {
        s.bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 180, 5), this.boltMat);
        s.bolt.position.copy(s.pos).setY(90);
        g.scene.add(s.bolt);
        g.effects.flash('rgba(230,240,255,0.7)');
        g.audio.play('thunder');
        g.effects.splash(s.pos.clone().setY(1), 2);
        for (const c of g.characters) {
          const p = c.worldPos(new THREE.Vector3());
          if (Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < 6) c.damage(1, s.pos);
        }
      }
      if (s.t > 1.6) {
        g.scene.remove(s.warn);
        if (s.bolt) g.scene.remove(s.bolt);
        this.strikes.splice(i, 1);
      }
    }
    if (q.is('storm') && !this.centerShown && Math.hypot(b.x - S.x, b.z - S.z) < 160) {
      this.centerShown = true;
      this.marker.visible = true;
      g.dialog.show(g.lines.stormCenter, () => q.advance('storm'));
    }
    if (q.is('raise') && !this.risen && this.rising === 0) this.marker.visible = true;
    if (this.marker.visible) this.marker.material.opacity = 0.5 + Math.sin(t * 3) * 0.3;

    // ----- 모투페투 떠오르기 -----
    if (this.rising > 0 && !this.risen) {
      this.rising = Math.min(1, this.rising + dt / 8);
      const k = smoothstep(0, 1, this.rising);
      MOTUFETU.sink = 70 * (1 - k);
      MOTUFETU.mesh.position.y = -MOTUFETU.sink;
      g.effects.shake = Math.max(g.effects.shake, 0.4);
      if (Math.random() < 0.3) g.effects.splash(new THREE.Vector3(S.x + (Math.random() - 0.5) * 300, 1, S.z + (Math.random() - 0.5) * 300), 3);
      if (this.rising >= 1) {
        this.risen = true;
        this.stormCleared = true;
        g.onMotufetuRisen();
      }
    }
  }
}

export { MOTUFETU, MATANGI };
