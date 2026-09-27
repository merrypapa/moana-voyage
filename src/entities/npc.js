// 마을 사람 등 NPC: 돌아다니기, 춤, 대화
import * as THREE from 'three';
import { buildNPC, animateHumanoid } from './models.js';
import { heightAt } from '../world/terrain.js';
import { approachAngle } from '../util.js';

export class NPC {
  constructor(game, kind, opts = {}) {
    this.game = game;
    this.kind = kind;
    this.model = buildNPC(kind, opts.seed || 0);
    this.mesh = this.model.root;
    this.name = opts.name || '마을 사람';
    this.home = new THREE.Vector3(opts.x, 0, opts.z);
    this.pos = new THREE.Vector3(opts.x, heightAt(opts.x, opts.z), opts.z);
    this.facing = opts.facing || 0;
    this.wander = opts.wander ?? 8;
    this.activity = opts.activity || 'wander'; // wander | dance | sit | idle
    this.talk = opts.talk || null; // () => lines
    this.lines = opts.lines || null;
    this.target = null;
    this.timer = Math.random() * 3;
    this.t = Math.random() * 10;
    this.speed = 0;
    this.visible = opts.visible ?? true;
    this.mesh.visible = this.visible;
    this.lineIdx = 0;
    game.scene.add(this.mesh);
  }

  setVisible(v) { this.visible = v; this.mesh.visible = v; }

  worldPos(out = new THREE.Vector3()) { return out.copy(this.pos); }

  nextLines() {
    if (this.talk) return this.talk();
    if (!this.lines) return null;
    const l = this.lines[this.lineIdx % this.lines.length];
    this.lineIdx++;
    return [{ who: this.name, text: l }];
  }

  update(dt, playerPos, camPos) {
    if (!this.visible) return;
    const far = camPos && (this.pos.x - camPos.x) ** 2 + (this.pos.z - camPos.z) ** 2 > 160 * 160;
    this.mesh.visible = !far;
    if (far) return;
    this.t += dt;
    let st = this.activity === 'dance' ? 'dance' : this.activity === 'sit' ? 'sit' : 'ground';
    this.speed = 0;
    // 플레이어가 가까우면 쳐다보기
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    const pd = Math.hypot(dx, dz);
    if (pd < 5 && this.activity !== 'dance') {
      this.facing = approachAngle(this.facing, Math.atan2(dx, dz), dt * 5);
      this.target = null;
    } else if (this.activity === 'wander' && this.wander > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 3 + Math.random() * 5;
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * this.wander;
          this.target = new THREE.Vector3(this.home.x + Math.sin(a) * d, 0, this.home.z + Math.cos(a) * d);
        } else this.target = null;
      }
      if (this.target) {
        const tx = this.target.x - this.pos.x, tz = this.target.z - this.pos.z;
        const d = Math.hypot(tx, tz);
        if (d < 0.4) this.target = null;
        else {
          const nx = this.pos.x + (tx / d) * 1.6 * dt, nz = this.pos.z + (tz / d) * 1.6 * dt;
          if (heightAt(nx, nz) > 0.6) { this.pos.x = nx; this.pos.z = nz; this.speed = 1.6; }
          else this.target = null;
          this.facing = approachAngle(this.facing, Math.atan2(tx, tz), dt * 6);
        }
      }
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    animateHumanoid(this.model, { state: st, speed: this.speed, t: this.t }, dt);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
  }
}
