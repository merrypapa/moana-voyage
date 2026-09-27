// 움직이는 몸체의 공통 물리: 배 위(배 기준 좌표) ↔ 땅/바다(월드 좌표) 전환
import * as THREE from 'three';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { MAST, BOX } from './boat.js';
import { approach, approachAngle } from '../util.js';

const tmp = new THREE.Vector3();

export class Body {
  constructor(game, mesh, opts = {}) {
    this.game = game;
    this.mesh = mesh;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0; // 현재 좌표계 기준 방향
    this.onBoat = false;
    this.grounded = false;
    this.inWater = false;
    this.radius = opts.radius || 0.35;
    this.stepMax = opts.stepMax || 0.9;
    this.gravity = opts.gravity || 24;
    this.canBoard = opts.canBoard !== false;
    this.noBoardTimer = 0;
    game.scene.add(mesh);
  }

  get boat() { return this.game.boat; }

  worldPos(out = new THREE.Vector3()) {
    if (this.onBoat) return this.boat.root.localToWorld(out.copy(this.pos));
    return out.copy(this.pos);
  }
  worldYaw() { return this.onBoat ? this.facing + this.boat.yaw : this.facing; }

  // 배 좌표계로 들어가기
  attachToBoat(localPos) {
    const b = this.boat;
    const wv = this.vel.clone();
    const bv = new THREE.Vector3(Math.sin(b.yaw) * b.speed, 0, Math.cos(b.yaw) * b.speed);
    wv.sub(bv);
    this.vel.set(
      wv.x * Math.cos(b.yaw) - wv.z * Math.sin(b.yaw),
      wv.y,
      wv.x * Math.sin(b.yaw) + wv.z * Math.cos(b.yaw)
    );
    this.facing -= b.yaw;
    this.pos.copy(localPos);
    this.onBoat = true;
    b.root.add(this.mesh);
    this.inWater = false;
  }

  detachFromBoat() {
    if (!this.onBoat) return;
    const b = this.boat;
    const wp = b.root.localToWorld(this.pos.clone());
    const lv = this.vel;
    const wx = lv.x * Math.cos(b.yaw) + lv.z * Math.sin(b.yaw);
    const wz = -lv.x * Math.sin(b.yaw) + lv.z * Math.cos(b.yaw);
    this.vel.set(wx + Math.sin(b.yaw) * b.speed, lv.y, wz + Math.cos(b.yaw) * b.speed);
    this.facing += b.yaw;
    this.pos.copy(wp);
    this.onBoat = false;
    this.game.scene.add(this.mesh);
    this.noBoardTimer = 0.4;
  }

  // 월드 좌표로 강제 이동 (바다 구조, 순간이동 등)
  setWorld(p) {
    if (this.onBoat) {
      this.facing += this.boat.yaw;
      this.onBoat = false;
      this.game.scene.add(this.mesh);
    }
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
  }

  placeOnBoat(local) {
    if (!this.onBoat) {
      this.facing -= this.boat.yaw;
      this.onBoat = true;
      this.boat.root.add(this.mesh);
    }
    this.pos.copy(local);
    this.vel.set(0, 0, 0);
    this.grounded = true;
    this.inWater = false;
  }

  surfaceLevel(x, z) {
    if (this.game.zone !== 'surface') return -Infinity;
    return waveHeight(x, z, this.game.time);
  }

  // wishX/Z: 월드 기준 원하는 수평 속도
  physics(dt, wishX, wishZ, accel = 40) {
    if (this.noBoardTimer > 0) this.noBoardTimer -= dt;
    let wx = wishX, wz = wishZ;
    const b = this.boat;
    if (this.onBoat) {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      wx = wishX * c - wishZ * s;
      wz = wishX * s + wishZ * c;
    }
    const a = this.grounded ? accel : accel * 0.3;
    this.vel.x = approach(this.vel.x, wx, a * dt);
    this.vel.z = approach(this.vel.z, wz, a * dt);
    this.vel.y -= this.gravity * dt;
    const px = this.pos.x, py = this.pos.y, pz = this.pos.z;
    this.pos.addScaledVector(this.vel, dt);

    if (this.onBoat) {
      if (!b.onDeck(this.pos.x, this.pos.z)) {
        if (this.pos.y > -0.3) {
          this.detachFromBoat();
          this.grounded = false;
        }
        return;
      }
      let dh = b.deckHeight(this.pos.x, this.pos.z);
      if (dh > py + 0.4) {
        // 상자 옆면에 막힘
        this.pos.x = px; this.pos.z = pz;
        dh = b.deckHeight(px, pz);
      }
      const mx = this.pos.x - MAST.x, mz = this.pos.z - MAST.z;
      const md = Math.hypot(mx, mz);
      const minD = MAST.r + this.radius * 0.6;
      if (md < minD && md > 1e-4) { this.pos.x = MAST.x + (mx / md) * minD; this.pos.z = MAST.z + (mz / md) * minD; }
      if (this.pos.y <= dh) { this.pos.y = dh; this.vel.y = 0; this.grounded = true; }
      else this.grounded = this.pos.y - dh < 0.05;
      return;
    }

    let gh = heightAt(this.pos.x, this.pos.z);
    if (gh > Math.max(py, heightAt(px, pz)) + this.stepMax) {
      // 절벽/벽
      this.pos.x = px; this.pos.z = pz;
      gh = heightAt(px, pz);
      this.vel.x *= 0.2; this.vel.z *= 0.2;
    }
    // 배에 올라타기
    if (this.canBoard && b && b.unlocked && this.noBoardTimer <= 0 && this.game.zone === 'surface') {
      const dx = this.pos.x - b.x, dz = this.pos.z - b.z;
      if (dx * dx + dz * dz < 100) {
        const local = b.root.worldToLocal(tmp.copy(this.pos));
        if (b.onDeck(local.x, local.z) && local.y > -0.8 && local.y < 3 && this.vel.y <= 1) {
          const dh = b.deckHeight(local.x, local.z);
          if (local.y < dh) local.y = dh;
          this.attachToBoat(local);
          this.grounded = local.y <= dh + 0.01;
          if (this.grounded) this.vel.y = 0;
          return;
        }
      }
    }
    if (this.pos.y <= gh) {
      this.pos.y = gh; this.vel.y = 0; this.grounded = true;
    } else {
      this.grounded = this.pos.y - gh < 0.05;
    }
    const surf = this.surfaceLevel(this.pos.x, this.pos.z);
    this.inWater = gh < surf - 1.0 && this.pos.y < surf - 0.6;
  }

  faceToward(dirX, dirZ, dt, rate = 10) {
    if (dirX * dirX + dirZ * dirZ < 1e-4) return;
    let yaw = Math.atan2(dirX, dirZ);
    if (this.onBoat) yaw -= this.boat.yaw;
    this.facing = approachAngle(this.facing, yaw, rate * dt);
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.facing, 0);
  }

  distanceTo(other) {
    const a = this.worldPos(tmp);
    const bpos = other.worldPos ? other.worldPos(new THREE.Vector3()) : other;
    return a.distanceTo(bpos);
  }
}

export { BOX };
