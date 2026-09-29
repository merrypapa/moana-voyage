// 거북이 섬의 거북이들
// - TurtleHerd: 섬에 사는 100마리 (인스턴싱으로 가볍게 그림)
// - Turtle: 안아 든 거북이. 배에 태우고, 거북이 상자에 넣고, 바다에 빠지면 헤엄쳐 따라온다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Critter } from './critters.js';
import { mat, part } from './models.js';
import { bakeHierarchy } from '../world/bake.js';
import { TBOX, DECK } from './boat.js';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { ISLANDS } from '../config.js';
import { clamp, mulberry32, approachAngle } from '../util.js';

const SHELL = '#557a3a', SHELL_BABY = '#7fa44c', SPOT = '#3b5a28', SKIN = '#9ab574', BELLY = '#e0cf94';
export const BABY_SCALE = 0.45;

// ---------- 개별 거북이 모델 ----------
export function buildTurtleModel(baby) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(baby ? SHELL_BABY : SHELL));
  shell.scale.set(1, 0.6, 1.2);
  shell.position.y = 0.12;
  shell.castShadow = true;
  body.add(shell);
  for (const [x, z] of [[0, 0], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2], [0, 0.35], [0, -0.35]]) {
    part('sphere', mat(SPOT), 0.13, 0.05, 0.13, x, 0.12 + 0.26 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / 0.3)), z, body);
  }
  part('cyl', mat(BELLY), 0.44, 0.05, 0.5, 0, 0.11, 0, body).scale.set(0.44, 0.05, 0.52);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.58);
  part('sphere', mat(SKIN), 0.13, 0.12, 0.16, 0, 0, 0.04, head);
  part('sphereSmooth', mat('#111'), 0.025, 0.025, 0.02, -0.08, 0.04, 0.12, head);
  part('sphereSmooth', mat('#111'), 0.025, 0.025, 0.02, 0.08, 0.04, 0.12, head);
  body.add(head);
  const flippers = [];
  for (const [x, z, front] of [[-0.36, 0.3, 1], [0.36, 0.3, 1], [-0.3, -0.38, 0], [0.3, -0.38, 0]]) {
    const f = new THREE.Group();
    f.position.set(x, 0.11, z);
    const fl = part('box', mat(SKIN), front ? 0.34 : 0.22, 0.05, front ? 0.15 : 0.12, Math.sign(x) * (front ? 0.15 : 0.1), 0, 0, f);
    fl.rotation.y = Math.sign(x) * (front ? -0.35 : 0.3);
    body.add(f);
    flippers.push(f);
  }
  const tail = part('cone', mat(SKIN), 0.05, 0.14, 0.05, 0, 0.11, -0.6, body);
  tail.rotation.x = -Math.PI / 2;
  const s = baby ? BABY_SCALE : 1;
  body.scale.setScalar(s);
  const parts = { root, body, head, flippers, H: 0.4 * s };
  root.userData.parts = parts;
  root.name = baby ? 'babyTurtle' : 'turtle';
  bakeHierarchy(root);
  return parts;
}

export function animateTurtle(p, t, speed, swimming) {
  if (swimming) {
    const k = Math.sin(t * 5);
    p.flippers.forEach((f, i) => { f.rotation.z = (i % 2 ? -1 : 1) * k * (i < 2 ? 0.6 : 0.3); f.rotation.y = 0; });
    p.body.position.y = 0;
    p.head.rotation.x = -0.2;
  } else {
    const k = Math.sin(t * 8) * Math.min(1, speed * 2);
    p.flippers.forEach((f, i) => { f.rotation.y = ((i === 0 || i === 3) ? k : -k) * 0.5; f.rotation.z = 0; });
    p.body.position.y = Math.abs(k) * 0.02;
    p.head.rotation.x = Math.sin(t * 1.3) * 0.15;
  }
}

// ---------- 배에 태우는 거북이 ----------
export class Turtle extends Critter {
  constructor(game, baby) {
    super(game, 'turtle', buildTurtleModel(baby));
    this.baby = baby;
    this.name = baby ? '아기 거북이' : '거북이';
    this.crew = false; // 배에 한 번이라도 탔으면 배를 따라다닌다
    this.swimT = 0;
    this.followT = 0;
    this.radius = baby ? 0.2 : 0.4;
  }

  release(onBoat, localPos, intoWater) {
    super.release(onBoat, localPos, false);
    if (onBoat) this.crew = true;
    if (intoWater) this.startSwim();
  }

  enterBox() {
    const b = this.boat;
    if (this.carrier) { this.carrier.carrying = null; this.carrier = null; }
    if (!this.onBoat || this.mesh.parent !== b.root) {
      this.onBoat = false;
      this.placeOnBoat(new THREE.Vector3(TBOX.x, TBOX.h, TBOX.z));
    }
    this.state = 'inBox';
    this.crew = true;
    this.mesh.visible = false;
    this.pos.set(TBOX.x, TBOX.h, TBOX.z);
    if (!b.tbox.list.includes(this)) b.tbox.list.push(this);
    b.tbox.target = 1;
    b.tbox.closeT = 0.7;
    this.game.audio.play('pickup');
  }

  exitBox(jump = true) {
    const b = this.boat;
    b.tbox.list = b.tbox.list.filter((x) => x !== this);
    b.tbox.target = 1;
    b.tbox.closeT = 1.2;
    this.mesh.visible = true;
    this.state = 'wander';
    this.timer = 1;
    this.target = null;
    this.onBoat = false;
    this.placeOnBoat(new THREE.Vector3(TBOX.x, TBOX.h + 0.1, TBOX.z));
    if (jump) {
      const a = Math.random() * Math.PI * 2;
      this.vel.set(Math.sin(a) * 1.4 + 1.2, 4.5, Math.cos(a) * 1.4);
    }
  }

  pickTarget() {
    const r = Math.random;
    if (this.onBoat) {
      // 가끔 뱃전 너머로 기어가다 바다에 풍덩
      if (r() < 0.1) {
        const side = r() < 0.5 ? -1 : 1;
        return new THREE.Vector3(side * (DECK.halfW + 1.2), 0, (r() - 0.5) * 7);
      }
      return new THREE.Vector3((r() - 0.5) * (DECK.halfW * 2 - 0.6), 0, (r() - 0.5) * (DECK.halfL * 2 - 0.6));
    }
    const a = r() * Math.PI * 2, d = 2 + r() * 10;
    return new THREE.Vector3(this.home.x + Math.sin(a) * d, 0, this.home.z + Math.cos(a) * d);
  }

  startSwim() {
    if (this.onBoat) this.detachFromBoat();
    this.state = 'swim';
    this.swimT = 0;
    this.followT = 6 + Math.random() * 14; // 이만큼 배 옆에서 헤엄치다가 올라온다
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.vel.set(0, 0, 0);
    this.game.effects.splash(this.worldPos(new THREE.Vector3()), 0.5);
    this.game.audio.play('splash');
  }

  updateSwim(dt) {
    const g = this.game;
    const b = this.boat;
    this.swimT += dt;
    const surf = waveHeight(this.pos.x, this.pos.z, g.time);
    let tx, tz, speed = 3.5;
    if (this.crew && b.unlocked && g.zone === 'surface') {
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      const d = Math.hypot(b.x - this.pos.x, b.z - this.pos.z);
      if (d > 260) {
        // 너무 멀어지면 해류를 타고 배 뒤로 따라붙는다
        this.pos.set(b.x - fx * 35 + fz * this.side * 6, surf, b.z - fz * 35 - fx * this.side * 6);
      }
      const climb = this.swimT > this.followT && Math.abs(b.speed) < 12;
      const off = climb ? DECK.halfW + 0.6 : DECK.halfW + 3.5;
      // 배 옆 (climb이면 뱃전 바로 옆)
      tx = b.x + fz * this.side * off + fx * (climb ? 0 : 1.5);
      tz = b.z - fx * this.side * off + fz * (climb ? 0 : 1.5);
      const dd = Math.hypot(tx - this.pos.x, tz - this.pos.z);
      speed = clamp(3 + dd * 0.25, 3, 16);
      if (dd < 8) speed = Math.max(speed, Math.abs(b.speed));
      if (climb && dd < 1.6) {
        // 배 위로 기어 올라오기
        const local = b.root.worldToLocal(this.pos.clone());
        local.x = clamp(local.x, -DECK.halfW + 0.4, DECK.halfW - 0.4);
        local.z = clamp(local.z, -DECK.halfL + 0.5, DECK.halfL - 0.5);
        local.y = b.deckHeight(local.x, local.z);
        this.placeOnBoat(local);
        this.state = 'wander';
        this.timer = 2;
        this.target = null;
        g.effects.splash(b.root.localToWorld(local.clone()), 0.4);
        return;
      }
    } else {
      // 배가 없으면 가까운 모래사장으로
      tx = this.home.x; tz = this.home.z;
      if (heightAt(this.pos.x, this.pos.z) > -0.4) { this.state = 'wander'; this.timer = 1; return; }
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const L = Math.hypot(dx, dz) || 1;
    const step = Math.min(L, speed * dt);
    this.pos.x += (dx / L) * step;
    this.pos.z += (dz / L) * step;
    this.pos.y = surf - 0.12 + Math.sin(this.animT * 2) * 0.05;
    if (L > 0.2) this.facing = approachAngle(this.facing, Math.atan2(dx, dz), dt * 4);
    this.speedNow = step / dt;
  }

  animateOnly(dt) {
    this.animT += dt;
    if (this.state === 'inBox') return;
    animateTurtle(this.model, this.animT, this.speedNow || 0, this.state === 'swim' || this.state === 'carried');
    if (this.state !== 'carried') this.syncMesh();
  }

  update(dt) {
    this.animT += dt;
    const s = this.state;
    if (s === 'inBox') return;
    if (s === 'carried' || s === 'rescue' || s === 'frozen') {
      animateTurtle(this.model, this.animT, 1, true);
      if (s !== 'carried') this.syncMesh();
      return;
    }
    if (s === 'swim') {
      this.updateSwim(dt);
      animateTurtle(this.model, this.animT, this.speedNow, this.state === 'swim');
      this.syncMesh();
      return;
    }
    // 걸어 다니기 (배 위 또는 땅)
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 3 + Math.random() * 5;
      this.target = Math.random() < 0.3 ? null : this.pickTarget();
    }
    let wishX = 0, wishZ = 0;
    const speed = this.baby ? 0.9 : 0.6;
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) this.target = null;
      else {
        let wx = (dx / d) * speed, wz = (dz / d) * speed;
        if (this.onBoat) {
          const b = this.boat, c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
          const lx = wx, lz = wz;
          wx = lx * c + lz * sn; wz = -lx * sn + lz * c;
        }
        wishX = wx; wishZ = wz;
      }
    }
    this.physics(dt, wishX, wishZ, 10);
    if (Math.abs(wishX) + Math.abs(wishZ) > 0.01) this.faceToward(wishX, wishZ, dt, 3);
    this.speedNow = Math.hypot(wishX, wishZ);
    const surf = this.surfaceLevel(this.pos.x, this.pos.z);
    if (!this.onBoat && this.pos.y < surf - 0.3 && heightAt(this.pos.x, this.pos.z) < surf - 0.5) this.startSwim();
    animateTurtle(this.model, this.animT, this.speedNow, false);
    this.syncMesh();
  }
}

// ---------- 섬에 사는 100마리 ----------
function coloredGeo(geo, hex, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  if (matrix) g.applyMatrix4(matrix);
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function herdGeometry() {
  // 걷기 모양 하나로 합친 거북이 (인스턴싱용). 등껍질 색은 인스턴스 색으로 바꾼다.
  const m = (x, y, z, sx, sy, sz, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
  const shell = [coloredGeo(new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', m(0, 0.12, 0, 1, 0.6, 1.2))];
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const skin = [
    coloredGeo(ico, SKIN, m(0, 0.2, 0.62, 0.13, 0.12, 0.16)),
    coloredGeo(new THREE.CylinderGeometry(1, 1, 1, 10), BELLY, m(0, 0.11, 0, 0.44, 0.05, 0.52)),
    coloredGeo(box, SKIN, m(-0.5, 0.11, 0.3, 0.34, 0.05, 0.15, 0.35)),
    coloredGeo(box, SKIN, m(0.5, 0.11, 0.3, 0.34, 0.05, 0.15, -0.35)),
    coloredGeo(box, SKIN, m(-0.4, 0.11, -0.38, 0.22, 0.05, 0.12, -0.3)),
    coloredGeo(box, SKIN, m(0.4, 0.11, -0.38, 0.22, 0.05, 0.12, 0.3)),
    coloredGeo(ico, '#111111', m(-0.08, 0.24, 0.74, 0.025, 0.025, 0.02)),
    coloredGeo(ico, '#111111', m(0.08, 0.24, 0.74, 0.025, 0.025, 0.02)),
  ];
  return { shell: mergeGeometries(shell), skin: mergeGeometries(skin) };
}

export class TurtleHerd {
  constructor(game, count = 100) {
    this.game = game;
    this.island = ISLANDS.find((i) => i.turtles);
    const geo = herdGeometry();
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    this.shellMesh = new THREE.InstancedMesh(geo.shell, vc, count);
    this.skinMesh = new THREE.InstancedMesh(geo.skin, vc, count);
    for (const im of [this.shellMesh, this.skinMesh]) {
      im.castShadow = true;
      im.frustumCulled = false;
      game.scene.add(im);
    }
    this.list = [];
    const rnd = mulberry32(2024);
    const isl = this.island;
    const shellCols = ['#557a3a', '#4f6b35', '#6b7a3a', '#5a6a45', '#7fa44c', '#8ab05a'];
    // 대부분은 모투누이 쪽(배가 도착하는 북서쪽) '거북이 해변'에 모여 산다
    const beachDir = Math.atan2(-isl.x, -isl.z);
    let tries = 0;
    while (this.list.length < count && tries < 40000) {
      tries++;
      const baby = this.list.length < count * 0.6;
      const swim = rnd() < 0.25;
      const onBeach = rnd() < 0.85;
      const a = onBeach ? beachDir + (rnd() - 0.5) * 1.6 : rnd() * Math.PI * 2;
      const r = 60 + rnd() * (isl.radius + 10);
      const x = isl.x + Math.sin(a) * r, z = isl.z + Math.cos(a) * r;
      const h = heightAt(x, z);
      if (swim ? !(h < -1.2 && h > -8) : !(h > 0.3 && h < 3.5)) continue;
      const t = {
        i: this.list.length, x, z, homeX: x, homeZ: z, yaw: rnd() * Math.PI * 2, baby, swim,
        size: baby ? BABY_SCALE * (0.85 + rnd() * 0.3) : 0.9 + rnd() * 0.25,
        target: null, timer: rnd() * 5, taken: false, phase: rnd() * 10,
      };
      this.list.push(t);
      const col = new THREE.Color(baby ? shellCols[4 + (t.i % 2)] : shellCols[t.i % 4]);
      this.shellMesh.setColorAt(t.i, col);
      this.skinMesh.setColorAt(t.i, new THREE.Color('#ffffff'));
    }
    this.shellMesh.count = this.skinMesh.count = this.list.length;
    this.dummy = new THREE.Object3D();
    this.near = false;
    this.writeAll(0);
  }

  get remaining() { return this.list.filter((t) => !t.taken).length; }

  writeOne(t, time) {
    const d = this.dummy;
    if (t.taken) {
      d.scale.setScalar(0.0001);
    } else {
      const y = t.swim ? waveHeight(t.x, t.z, time) - 0.1 : heightAt(t.x, t.z);
      const bob = t.moving ? Math.abs(Math.sin(time * 8 + t.phase)) * 0.02 : 0;
      d.position.set(t.x, y + bob, t.z);
      d.rotation.set(0, t.yaw, t.moving ? Math.sin(time * 8 + t.phase) * 0.05 : 0);
      d.scale.setScalar(t.size);
    }
    d.updateMatrix();
    this.shellMesh.setMatrixAt(t.i, d.matrix);
    this.skinMesh.setMatrixAt(t.i, d.matrix);
  }

  writeAll(time) {
    for (const t of this.list) this.writeOne(t, time);
    this.shellMesh.instanceMatrix.needsUpdate = true;
    this.skinMesh.instanceMatrix.needsUpdate = true;
  }

  // 가까운 거북이 찾기 (안아 들기용)
  nearest(p, maxD) {
    let best = null, bd = maxD;
    for (const t of this.list) {
      if (t.taken) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best ? { t: best, d: bd } : null;
  }

  take(t) {
    t.taken = true;
    this.writeOne(t, this.game.time);
    this.shellMesh.instanceMatrix.needsUpdate = true;
    this.skinMesh.instanceMatrix.needsUpdate = true;
  }

  // 저장된 게임에서 배로 데려간 수만큼 빼기
  removeCount(n, babies) {
    for (const t of this.list) {
      if (n <= 0) break;
      if (t.taken || t.baby !== babies) continue;
      t.taken = true; n--;
    }
    this.writeAll(this.game.time);
  }

  update(dt, time, camPos) {
    const isl = this.island;
    const near = Math.hypot(camPos.x - isl.x, camPos.z - isl.z) < 700;
    this.shellMesh.visible = this.skinMesh.visible = near;
    if (!near) return;
    for (const t of this.list) {
      if (t.taken) continue;
      t.timer -= dt;
      if (t.timer <= 0) {
        t.timer = 3 + Math.random() * 6;
        if (Math.random() < 0.35) t.target = null;
        else {
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 12;
            const x = t.homeX + Math.sin(a) * r, z = t.homeZ + Math.cos(a) * r;
            const h = heightAt(x, z);
            if (t.swim ? h < -1 && h > -12 : h > 0.2) { t.target = { x, z }; break; }
          }
        }
      }
      t.moving = false;
      if (t.target) {
        const dx = t.target.x - t.x, dz = t.target.z - t.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) t.target = null;
        else {
          const sp = (t.swim ? 1.6 : t.baby ? 0.9 : 0.55) * dt;
          t.x += (dx / d) * sp; t.z += (dz / d) * sp;
          t.yaw = approachAngle(t.yaw, Math.atan2(dx, dz), dt * 2.5);
          t.moving = true;
        }
      }
      this.writeOne(t, time);
    }
    this.shellMesh.instanceMatrix.needsUpdate = true;
    this.skinMesh.instanceMatrix.needsUpdate = true;
  }
}
