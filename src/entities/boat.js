// 모아나의 배 (아웃리거 카누): 항해 물리, 돛대, 헤이헤이 상자
import * as THREE from 'three';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { WORLD, REEF } from '../config.js';
import { clamp, approach, wrapAngle, damp } from '../util.js';
import { sailTexture, woodTexture } from '../textures.js';
import { mat, part } from './models.js';
import { bakeHierarchy } from '../world/bake.js';

export const DECK = { halfW: 2.3, halfL: 5.4 };
export const BOX = { x: 1.45, z: -3.0, half: 0.55, h: 1.1 };
export const MAST = { x: 0, z: 1.0, height: 9.0, r: 0.3 };
export const HELM = { x: 0, z: -4.7 };

function canoeHull(length, width, height, segs = 16) {
  const g = new THREE.BoxGeometry(width, height, length, 4, 2, segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / (length / 2); // -1..1
    const taper = 1 - Math.pow(Math.abs(z), 2.2);
    let x = p.getX(i) * Math.max(0.08, taper);
    let y = p.getY(i);
    // 아래쪽은 둥글게, 양 끝은 위로 휘게
    if (y < 0) x *= 0.55;
    y += Math.pow(Math.abs(z), 3) * height * 0.9 * (y > 0 ? 1.4 : 1);
    p.setXYZ(i, x, y, p.getZ(i));
  }
  g.computeVertexNormals();
  return g;
}

export class Boat {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.root.name = 'boat';
    this.x = 0; this.z = 0; this.yaw = 0;
    this.speed = 0; this.throttle = 0; this.rudder = 0;
    this.pitch = 0; this.roll = 0; this.y = 0;
    this.helmsman = null;
    this.upgrade = 1;
    this.anchored = true;
    this.box = { open: 0, target: 0, heihei: false, wiggle: 0 };
    this.unlocked = false; // 동굴에서 배를 찾기 전에는 잠겨 있음
    this._build();
    scene.add(this.root);
    this._tmp = new THREE.Vector3();
    this.foam = [];
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    const fg = new THREE.CircleGeometry(1, 8);
    fg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(fg, foamMat.clone());
      m.visible = false;
      scene.add(m);
      this.foam.push({ m, life: 0 });
    }
    this._foamTimer = 0;
  }

  _build() {
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), color: '#f0c898', flatShading: true, roughness: 0.9 });
    const dark = mat('#5a3a20');
    // 선체
    const hull = new THREE.Mesh(canoeHull(14, 1.7, 1.3), wood);
    hull.position.set(0, -0.62, 0);
    hull.castShadow = true;
    this.root.add(hull);
    // 선체 위 장식 띠
    part('box', mat('#e6d2a4'), 0.08, 0.1, 10, -0.82, -0.08, 0, this.root);
    part('box', mat('#e6d2a4'), 0.08, 0.1, 10, 0.82, -0.08, 0, this.root);
    // 아웃리거(아마)
    const ama = new THREE.Mesh(canoeHull(8, 0.6, 0.5, 10), wood);
    ama.position.set(4.3, -0.65, 0);
    ama.castShadow = true;
    this.root.add(ama);
    for (const z of [-2.2, 2.2]) {
      part('cyl', dark, 0.09, 4.6, 0.09, 2.2, -0.15, z, this.root).rotation.z = Math.PI / 2;
      part('cyl', dark, 0.05, 0.7, 0.05, 4.3, -0.4, z, this.root);
    }
    // 갑판 (걸을 수 있는 판자)
    const deck = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const plank = part('box', wood, DECK.halfW * 2, 0.12, 1.15, 0, -0.06, -DECK.halfL + 0.6 + i * 1.2, deck);
      plank.receiveShadow = true;
    }
    this.root.add(deck);
    // 돛대
    part('cyl', dark, 0.13, MAST.height, 0.13, MAST.x, MAST.height / 2, MAST.z, this.root);
    part('cyl', dark, 0.05, 1.6, 0.05, MAST.x, MAST.height - 0.4, MAST.z, this.root).rotation.z = Math.PI / 2;
    // 망대 (꼭대기 발판)
    part('cyl', wood, 0.55, 0.08, 0.55, MAST.x, MAST.height - 0.9, MAST.z, this.root);
    // 밧줄
    const rope = mat('#c9b48a');
    for (const [x, z] of [[-2.1, 4.8], [2.1, 4.8], [-2.1, -4.8], [2.1, -4.8]]) {
      const a = new THREE.Vector3(x, 0, z), b = new THREE.Vector3(MAST.x, MAST.height - 0.9, MAST.z);
      const L = a.distanceTo(b);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, L, 4), rope);
      r.position.copy(a).add(b).multiplyScalar(0.5);
      r.lookAt(b);
      r.rotateX(Math.PI / 2);
      this.root.add(r);
    }
    // 돛 (게 집게 모양)
    this.sailPivot = new THREE.Group();
    this.sailPivot.position.set(MAST.x, 0, MAST.z);
    this.root.add(this.sailPivot);
    const sg = new THREE.PlaneGeometry(1, 1, 8, 8);
    const sp = sg.attributes.position;
    const uv = sg.attributes.uv;
    for (let i = 0; i < sp.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      // u: 앞(돛대)→뒤, v: 아래→위. 위쪽이 넓은 게 집게 모양
      const top = 9.4 - 1.2 * u * u;
      const bottom = 1.6 + 1.2 * u;
      const y = bottom + (top - bottom) * v;
      const z = 0.2 - u * (4.4 + v * 1.4);
      sp.setXYZ(i, 0, y, z);
    }
    sg.computeVertexNormals();
    this.sailBase = Float32Array.from(sp.array);
    this.sail = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: sailTexture(), side: THREE.DoubleSide, flatShading: true, roughness: 0.9 }));
    this.sail.castShadow = true;
    this.sail.userData.keep = true;
    this.sailPivot.add(this.sail);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.2, 5), dark);
    yard.position.set(0, 8.3, -2.6); yard.rotation.x = 1.25;
    this.sailPivot.add(yard);
    // 키 (조종 노)
    this.oar = new THREE.Group();
    this.oar.position.set(HELM.x, 0.5, HELM.z - 0.9);
    part('cyl', dark, 0.07, 4.2, 0.07, 0, -0.9, -1.1, this.oar).rotation.x = -0.55;
    part('box', dark, 0.08, 1.4, 0.55, 0, -2.7, -2.2, this.oar).rotation.x = -0.55;
    this.root.add(this.oar);
    part('cyl', dark, 0.09, 1.0, 0.09, HELM.x, 0.5, HELM.z - 0.9, this.root);
    // 헤이헤이 상자 (네모 통)
    this.boxGroup = new THREE.Group();
    this.boxGroup.position.set(BOX.x, 0, BOX.z);
    const bw = BOX.half * 2;
    const boxMat = new THREE.MeshStandardMaterial({ map: woodTexture(), color: '#a0703f', flatShading: true });
    part('box', boxMat, bw, BOX.h - 0.1, bw, 0, (BOX.h - 0.1) / 2, 0, this.boxGroup);
    part('box', mat('#3a2412'), bw + 0.04, 0.08, bw + 0.04, 0, 0.25, 0, this.boxGroup);
    part('box', mat('#3a2412'), bw + 0.04, 0.08, bw + 0.04, 0, BOX.h - 0.3, 0, this.boxGroup);
    this.lid = new THREE.Group();
    this.lid.position.set(0, BOX.h - 0.1, -BOX.half);
    part('box', boxMat, bw + 0.06, 0.1, bw + 0.06, 0, 0.05, BOX.half, this.lid);
    part('box', mat('#e6d2a4'), 0.3, 0.05, 0.08, 0, 0.12, bw, this.lid);
    this.boxGroup.add(this.lid);
    this.root.add(this.boxGroup);
    // 갑판 소품
    for (const [x, z] of [[-1.6, 4.3], [-1.2, 4.6], [-1.8, 4.7]]) part('sphere', mat('#5a3a1c'), 0.18, 0.2, 0.18, x, 0.18, z, this.root);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 14), rope);
    coil.rotation.x = Math.PI / 2; coil.position.set(-1.5, 0.07, -2.2);
    this.root.add(coil);
    // 뱃머리 장식
    part('cone', mat('#e6d2a4'), 0.15, 0.9, 0.15, 0, 1.0, 7.1, this.root).rotation.x = 0.4;
    this.hull = hull;
    bakeHierarchy(this.root);
  }

  // 배 좌표 <-> 월드 좌표
  localToWorld(v) { return this.root.localToWorld(v); }
  worldToLocal(v) { return this.root.worldToLocal(v); }

  deckHeight(lx, lz) {
    if (Math.abs(lx - BOX.x) < BOX.half && Math.abs(lz - BOX.z) < BOX.half) return BOX.h;
    return 0;
  }
  onDeck(lx, lz) { return Math.abs(lx) <= DECK.halfW && Math.abs(lz) <= DECK.halfL; }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  setPose(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw; this.speed = 0; this.throttle = 0;
  }

  _collides(x, z, yaw) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const pts = [[0, 6.6], [0, -6.2], [-1.3, 3], [-1.3, -3], [1.3, 3], [1.3, -3], [4.3, 3.6], [4.3, -3.6]];
    for (const [lx, lz] of pts) {
      const wx = x + c * lx + s * lz, wz = z - s * lx + c * lz;
      if (heightAt(wx, wz) > -0.9) return true;
    }
    // 모투누이 암초 바위
    const dr = Math.hypot(x - REEF.x, z - REEF.z);
    if (Math.abs(dr - REEF.r) < 14) {
      const ang = Math.atan2(x - REEF.x, z - REEF.z);
      if (Math.abs(wrapAngle(ang - REEF.gapAngle)) > REEF.gapWidth) return 'reef';
    }
    return false;
  }

  update(dt, t, game) {
    const cmd = this.helmsman ? this.helmsman.cmd : null;
    if (cmd) {
      if (cmd.moveY > 0.2) this.throttle = Math.min(1, this.throttle + dt * 0.7 * cmd.moveY);
      else if (cmd.moveY < -0.2) this.throttle = Math.max(-0.25, this.throttle + dt * 0.9 * cmd.moveY);
      this.rudder = damp(this.rudder, cmd.moveX, 6, dt);
    } else {
      this.throttle = approach(this.throttle, 0, dt * 0.25);
      this.rudder = damp(this.rudder, 0, 3, dt);
    }
    const wind = game.wind;
    const rel = Math.cos(wrapAngle(wind.yaw - this.yaw));
    const windEff = 0.7 + 0.3 * rel;
    const boost = game.boatBoost || 1;
    const maxSpeed = 26 * this.upgrade * windEff * boost;
    const target = this.throttle >= 0 ? this.throttle * maxSpeed : this.throttle * 12;
    this.speed = approach(this.speed, target, dt * (Math.abs(target) > Math.abs(this.speed) ? 5 : 4));
    const turnRate = 0.6 * clamp(0.35 + Math.abs(this.speed) / 10, 0, 1.1);
    const nyaw = this.yaw - this.rudder * turnRate * dt;
    const nx = this.x + Math.sin(nyaw) * this.speed * dt;
    const nz = this.z + Math.cos(nyaw) * this.speed * dt;
    const hit = this._collides(nx, nz, nyaw);
    if (!hit) {
      this.x = nx; this.z = nz; this.yaw = nyaw;
    } else {
      if (Math.abs(this.speed) > 6) game.events.emit('boatBump', { reef: hit === 'reef', speed: this.speed });
      this.speed *= -0.25;
      this.throttle *= 0.3;
      if (!this._collides(this.x, this.z, nyaw)) this.yaw = nyaw;
    }
    const lim = WORLD.half * 0.97;
    if (Math.abs(this.x) > lim || Math.abs(this.z) > lim) {
      this.x = clamp(this.x, -lim, lim); this.z = clamp(this.z, -lim, lim);
      this.speed *= 0.5;
      game.events.emit('worldEdge');
    }
    // 파도에 흔들리기
    const f = this.forward(this._tmp);
    const hb = waveHeight(this.x + f.x * 5, this.z + f.z * 5, t);
    const hs = waveHeight(this.x - f.x * 5, this.z - f.z * 5, t);
    const hl = waveHeight(this.x - f.z * 2.5, this.z + f.x * 2.5, t);
    const hr = waveHeight(this.x + f.z * 2.5, this.z - f.x * 2.5, t);
    const h = (hb + hs + hl + hr) / 4;
    this.y = damp(this.y, h + 0.55, 6, dt);
    this.pitch = damp(this.pitch, Math.atan2(hs - hb, 10) - this.speed * 0.002, 4, dt);
    this.roll = damp(this.roll, Math.atan2(hr - hl, 5) * 0.8 + this.rudder * this.speed * 0.004, 4, dt);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.set(this.pitch, this.yaw, this.roll);
    this.root.updateMatrixWorld(true);

    // 돛: 올린 정도와 바람
    const sailLevel = clamp(Math.abs(this.throttle) * 1.2, 0.15, 1);
    this.sail.scale.y = 0.35 + 0.65 * sailLevel;
    this.sail.position.y = (1 - this.sail.scale.y) * 1.2;
    const want = clamp(wrapAngle(wind.yaw - this.yaw + Math.PI), -0.9, 0.9) * 0.6;
    this.sailPivot.rotation.y = damp(this.sailPivot.rotation.y, want, 2, dt);
    const sp = this.sail.geometry.attributes.position;
    const billow = 0.2 + sailLevel * 0.9;
    for (let i = 0; i < sp.count; i++) {
      const u = this.sail.geometry.attributes.uv.getX(i), v = this.sail.geometry.attributes.uv.getY(i);
      const b = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * billow + Math.sin(t * 3 + u * 4) * 0.05;
      sp.setX(i, this.sailBase[i * 3] + b * Math.sign(-want || 1));
    }
    sp.needsUpdate = true;
    this.oar.rotation.y = this.rudder * 0.5;

    // 헤이헤이 상자 뚜껑
    const b = this.box;
    b.open = approach(b.open, b.target, dt * 4);
    let lidA = -b.open * 1.9;
    if (b.heihei && b.target === 0) {
      b.wiggle -= dt;
      if (b.wiggle < -4 - Math.random() * 6) b.wiggle = 0.5;
      if (b.wiggle > 0) lidA = -Math.abs(Math.sin(t * 30)) * 0.25;
    }
    this.lid.rotation.x = lidA;

    // 물보라 자국
    this._foamTimer -= dt;
    if (Math.abs(this.speed) > 3 && this._foamTimer <= 0) {
      this._foamTimer = 0.08;
      const fo = this.foam.find((q) => q.life <= 0);
      if (fo) {
        fo.life = 1.6;
        const side = Math.random() < 0.5 ? -1 : 1;
        fo.m.position.set(this.x - f.x * 6 + f.z * side * 0.9, 0.1, this.z - f.z * 6 - f.x * side * 0.9);
        fo.m.visible = true;
      }
    }
    for (const fo of this.foam) {
      if (fo.life <= 0) continue;
      fo.life -= dt;
      fo.m.scale.setScalar(0.4 + (1.6 - fo.life) * 0.8);
      fo.m.material.opacity = Math.max(0, fo.life / 1.6) * 0.35;
      fo.m.position.y = waveHeight(fo.m.position.x, fo.m.position.z, t) + 0.05;
      if (fo.life <= 0) fo.m.visible = false;
    }
  }
}
