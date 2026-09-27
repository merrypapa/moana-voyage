// 플레이어 캐릭터 (모아나, 마우이): 걷기, 점프, 오르기, 키 잡기, 수영, 매 변신
import * as THREE from 'three';
import { Body } from './body.js';
import { buildMoana, buildMaui, animateHumanoid, animateHawk } from './models.js';
import { HELM, MAST, DECK } from './boat.js';
import { heightAt } from '../world/terrain.js';
import { clamp, damp, approach, josa } from '../util.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class Character extends Body {
  constructor(game, kind) {
    const model = kind === 'moana' ? buildMoana() : buildMaui();
    super(game, model.root, { radius: kind === 'maui' ? 0.6 : 0.35, stepMax: kind === 'maui' ? 1.1 : 0.9 });
    this.kind = kind;
    this.name = kind === 'moana' ? '모아나' : '마우이';
    this.model = model;
    this.state = 'ground';
    this.cmd = null;
    this.maxHp = kind === 'moana' ? 5 : 7;
    this.hp = this.maxHp;
    this.hunger = 100;
    this.invuln = 0;
    this.swing = 0;
    this.form = 'human';
    this.hasHook = false;
    this.carrying = null;
    this.climb = null;
    this.swimTime = 0;
    this.animT = Math.random() * 10;
    this.speedNow = 0;
    this.controlledBy = null; // 'local' | 'ai' | 'remote'(나중에)
    this.ai = { mode: 'npc', home: new THREE.Vector3(), timer: 0 };
  }

  get isPlayer() { return this.controlledBy === 'local'; }

  setHook(v) {
    this.hasHook = v;
    if (this.model.hook) this.model.hook.visible = v && this.form === 'human';
  }

  // 명령 → 월드 기준 이동 방향
  wishDir(cmd) {
    if (cmd.worldX !== undefined) return { x: cmd.worldX, z: cmd.worldZ, mag: Math.hypot(cmd.worldX, cmd.worldZ) };
    const y = cmd.camYaw || 0;
    const fx = Math.sin(y), fz = Math.cos(y);
    const rx = -Math.cos(y), rz = Math.sin(y);
    const x = fx * cmd.moveY + rx * cmd.moveX;
    const z = fz * cmd.moveY + rz * cmd.moveX;
    return { x, z, mag: Math.hypot(x, z) };
  }

  update(dt) {
    const cmd = this.cmd;
    this.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 2.2);
    if (this.transformCd > 0) this.transformCd -= dt;
    if (this.meleeTimer > 0) { this.meleeTimer -= dt; if (this.meleeTimer <= 0) this.game.combat.melee(this); }
    if (this.oarTimer > 0) { this.oarTimer -= dt; if (this.oarTimer <= 0) this.model.oar.visible = false; }
    if (!cmd) return this.animate(dt);

    if (cmd.transform && this.kind === 'maui') this.toggleHawk();
    if (cmd.action && this.state !== 'rescue' && this.state !== 'frozen') this.doAction();

    this.running = false;
    switch (this.state) {
      case 'ground': case 'air': case 'sit': this.move(dt, cmd); break;
      case 'climb': this.updateClimb(dt, cmd); break;
      case 'helm': this.updateHelm(dt, cmd); break;
      case 'swim': this.updateSwim(dt, cmd); break;
      case 'fly': this.updateFly(dt, cmd); break;
      default: break; // rescue, frozen, leap: 외부에서 조종
    }
    this.animate(dt);
  }

  moveSpeed(cmd) {
    let s = cmd.run ? (this.kind === 'maui' ? 11 : 10) : this.kind === 'maui' ? 5.5 : 5;
    if (this.hunger <= 0) s *= 0.6;
    if (this.carrying) s *= 0.8;
    return s;
  }

  move(dt, cmd) {
    const w = this.wishDir(cmd);
    if (this.state === 'sit' && w.mag > 0.1) this.state = 'ground';
    const sp = this.moveSpeed(cmd);
    this.physics(dt, w.x * sp, w.z * sp, 45);
    if (w.mag > 0.1) this.faceToward(w.x, w.z, dt, 12);
    if (cmd.jump && this.grounded) {
      this.vel.y = this.kind === 'maui' ? 9.5 : 8.8;
      this.grounded = false;
      this.game.audio.play('jump');
    }
    if (this.state !== 'sit') this.state = this.grounded ? 'ground' : 'air';
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.running = cmd.run && this.speedNow > 6.5;
    // 달릴 때 발밑 먼지(모래)
    if (this.running && this.grounded) {
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) {
        this.dustT = 0.12;
        const p = this.worldPos(new THREE.Vector3());
        this.game.effects.emit('dust', p.setY(p.y + 0.1), 2, { speed: 1.2, up: 1.5, size: 0.15, life: 0.5, gravity: 2 });
      }
    }
    if (this.inWater) this.enterWater();
  }

  enterWater() {
    this.game.audio.play('splash');
    this.game.effects.splash(this.worldPos(tmp));
    if (this.carrying) this.dropCarried(true);
    if (this.kind === 'maui' && this.isPlayer) {
      this.state = 'swim';
      this.swimTime = 0;
      this.vel.set(0, 0, 0);
    } else {
      this.game.rescue.start(this, { style: this.kind === 'maui' ? 'toss' : 'gentle' });
    }
  }

  updateSwim(dt, cmd) {
    this.swimTime += dt;
    const w = this.wishDir(cmd);
    const swim = cmd.run ? 6.5 : 4.2;
    this.pos.x += w.x * swim * dt;
    this.pos.z += w.z * swim * dt;
    this.running = cmd.run && w.mag > 0.1;
    if (w.mag > 0.1) this.faceToward(w.x, w.z, dt, 8);
    this.speedNow = w.mag * swim;
    const surf = this.surfaceLevel(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, surf - 1.1, 8, dt);
    const gh = heightAt(this.pos.x, this.pos.z);
    if (gh > surf - 1.2) { this.state = 'ground'; this.pos.y = Math.max(gh, this.pos.y); return; }
    const b = this.boat;
    if (b.unlocked && Math.hypot(this.pos.x - b.x, this.pos.z - b.z) < 9 && (cmd.jump || cmd.interact)) {
      const local = b.root.worldToLocal(tmp.copy(this.pos));
      local.x = clamp(local.x, -DECK.halfW + 0.3, DECK.halfW - 0.3);
      local.z = clamp(local.z, -DECK.halfL + 0.3, DECK.halfL - 0.3);
      local.y = 0;
      this.placeOnBoat(local);
      this.state = 'ground';
      this.game.audio.play('jump');
      return;
    }
    if (this.swimTime > 14) this.game.rescue.start(this, { style: 'toss' });
  }

  // 돛대/절벽 오르기
  startClimb(climbable) {
    if (this.carrying) return;
    this.climb = climbable;
    const a = climbable.a, bb = climbable.b;
    const seg = tmp2.copy(bb).sub(a);
    const t = clamp(tmp.copy(this.pos).sub(a).dot(seg) / seg.lengthSq(), 0, 1);
    this.climbT = t;
    const dx = this.pos.x - a.x, dz = this.pos.z - a.z;
    this.climbAngle = Math.atan2(dx, dz);
    this.state = 'climb';
    this.vel.set(0, 0, 0);
  }

  updateClimb(dt, cmd) {
    const c = this.climb;
    const len = c.a.distanceTo(c.b);
    const speed = c.speed || 3.2;
    const dy = cmd.moveY;
    this.climbMoving = Math.abs(dy) > 0.1;
    this.climbT = clamp(this.climbT + (dy * speed * dt) / len, 0, 1);
    const p = tmp.copy(c.a).lerp(c.b, this.climbT);
    const r = c.offset || 0.45;
    this.pos.set(p.x + Math.sin(this.climbAngle) * r, p.y, p.z + Math.cos(this.climbAngle) * r);
    this.facing = this.climbAngle + Math.PI;
    this.speedNow = 0;
    if (this.climbT <= 0 && dy < -0.1) return this.endClimb('bottom');
    if (this.climbT >= 1 && dy > 0.1 && c.exitTop) return this.endClimb('top');
    if (cmd.jump) {
      this.state = 'air';
      this.vel.set(Math.sin(this.climbAngle) * 5, 6, Math.cos(this.climbAngle) * 5);
      this.climb = null;
      this.game.audio.play('jump');
    }
  }

  endClimb(where) {
    const c = this.climb;
    this.climb = null;
    this.state = 'ground';
    if (where === 'top' && c.exitTop) {
      this.pos.copy(c.exitTop);
      this.pos.y = heightAt(this.pos.x, this.pos.z);
      this.game.events.emit('climbTop', { climbable: c, who: this });
    } else if (where === 'bottom') {
      this.pos.x += Math.sin(this.climbAngle) * 0.4;
      this.pos.z += Math.cos(this.climbAngle) * 0.4;
    }
  }

  get atMastTop() { return this.state === 'climb' && this.climb && this.climb.kind === 'mast' && this.climbT > 0.95; }

  // 배 조종
  takeHelm() {
    const b = this.boat;
    if (b.helmsman && b.helmsman !== this) b.helmsman.leaveHelm();
    b.helmsman = this;
    this.state = 'helm';
    this.pos.set(HELM.x, 0, HELM.z);
    this.vel.set(0, 0, 0);
    this.facing = 0;
    this.game.events.emit('takeHelm', this);
  }
  leaveHelm() {
    if (this.boat.helmsman === this) this.boat.helmsman = null;
    if (this.state === 'helm') this.state = 'ground';
  }
  updateHelm(dt, cmd) {
    this.pos.set(HELM.x, 0, HELM.z);
    this.facing = damp(this.facing, -this.boat.rudder * 0.4, 5, dt);
    this.speedNow = 0;
    if (cmd.jump) {
      this.leaveHelm();
      this.vel.y = 8; this.grounded = false; this.state = 'air';
    }
  }

  // 마우이 매 변신
  toggleHawk() {
    if (this.transformCd > 0) return;
    if (!this.hasHook) {
      this.game.hud.toast('갈고리가 없으면 변신할 수 없어! 🪝');
      this.transformCd = 1;
      return;
    }
    if (this.state === 'rescue' || this.state === 'frozen' || this.state === 'climb') return;
    this.transformCd = 0.6;
    const wp = this.worldPos(new THREE.Vector3());
    this.game.effects.poof(wp.clone().setY(wp.y + 1.2));
    this.game.audio.play('transform');
    if (this.form === 'human') {
      if (this.state === 'helm') this.leaveHelm();
      if (this.carrying) this.dropCarried();
      if (this.onBoat) this.detachFromBoat();
      this.form = 'hawk';
      this.state = 'fly';
      this.vel.y = 7;
      this.model.hawk.visible = true;
      this.model.body.visible = false;
      this.game.events.emit('transform', { who: this, form: 'hawk' });
      this.game.audio.play('hawk');
    } else {
      this.form = 'human';
      this.state = 'air';
      this.model.hawk.visible = false;
      this.model.body.visible = true;
      this.setHook(this.hasHook);
      this.game.events.emit('transform', { who: this, form: 'human' });
    }
  }

  updateFly(dt, cmd) {
    const w = this.wishDir(cmd);
    const sp = cmd.run ? 36 : 24;
    const k = 1 - Math.exp(-2.5 * dt);
    this.vel.x += (w.x * sp - this.vel.x) * k;
    this.vel.z += (w.z * sp - this.vel.z) * k;
    const vy = cmd.jumpHeld ? 10 : cmd.downHeld ? -12 : -1.2;
    this.vel.y += (vy - this.vel.y) * k;
    this.pos.addScaledVector(this.vel, dt);
    const floor = Math.max(heightAt(this.pos.x, this.pos.z), this.surfaceLevel(this.pos.x, this.pos.z)) + 1.2;
    if (this.pos.y < floor) { this.pos.y = floor; this.vel.y = Math.max(0, this.vel.y); }
    const ceil = this.game.zone === 'surface' ? 320 : 60;
    if (this.pos.y > ceil) { this.pos.y = ceil; this.vel.y = Math.min(0, this.vel.y); }
    if (w.mag > 0.1) this.faceToward(this.vel.x, this.vel.z, dt, 4);
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.flapping = cmd.jumpHeld || w.mag > 0.1;
    this.running = cmd.run && w.mag > 0.1;
  }

  // 행동 버튼: 모아나=코코넛 던지기/노 휘두르기, 마우이=갈고리 내려치기
  doAction() {
    if (this.swing > 0 || this.state === 'helm' || this.state === 'climb') return;
    if (this.form === 'hawk') return;
    const inv = this.game.inventory;
    if (this.kind === 'moana' && inv.coconut > 0 && !this.carrying) {
      inv.coconut--;
      this.swing = 1;
      this.game.combat.throwCoconut(this);
      this.game.audio.play('throw');
      return;
    }
    this.swing = 1;
    if (this.kind === 'moana') { this.model.oar.visible = true; this.oarTimer = 0.45; }
    this.game.audio.play(this.kind === 'maui' && this.hasHook ? 'smash' : 'swish');
    this.meleeTimer = 0.2;
  }

  damage(n, fromWorld) {
    if (this.invuln > 0 || this.state === 'rescue' || this.state === 'frozen') return;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 1.4;
    this.game.audio.play('hurt');
    this.game.effects.flash();
    if (fromWorld && this.state !== 'fly') {
      const wp = this.worldPos(tmp);
      const dx = wp.x - fromWorld.x, dz = wp.z - fromWorld.z;
      const L = Math.hypot(dx, dz) || 1;
      if (this.state === 'helm') this.leaveHelm();
      if (this.state === 'climb') { this.climb = null; }
      this.state = 'air';
      const kx = (dx / L) * 7, kz = (dz / L) * 7;
      if (this.onBoat) {
        const b = this.boat, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
        this.vel.set(kx * c - kz * s, 6, kx * s + kz * c);
      } else this.vel.set(kx, 6, kz);
    }
    if (this.hp <= 0) {
      this.game.hud.toast(`${josa(this.name, '이', '가')} 지쳤어요... 바다가 도와줘요! 🌊`);
      this.hp = this.maxHp;
      this.game.rescue.start(this, { style: 'gentle' });
    }
  }

  // 헤이헤이/푸아 들기
  pickUp(critter) {
    this.carrying = critter;
    critter.setCarried(this);
    this.game.audio.play(critter.kind === 'heihei' ? 'bok' : 'oink');
  }
  dropCarried(intoWater = false) {
    const c = this.carrying;
    if (!c) return;
    this.carrying = null;
    const f = this.facing;
    const p = this.pos.clone();
    p.x += Math.sin(f) * 0.9; p.z += Math.cos(f) * 0.9; p.y += 0.3;
    c.release(this.onBoat, p, intoWater);
  }

  animate(dt) {
    const m = this.model;
    if (this.form === 'hawk') {
      animateHawk(m, this.animT, this.flapping);
      m.hawk.rotation.z = damp(m.hawk.rotation.z, 0, 3, dt);
      m.hawk.rotation.x = damp(m.hawk.rotation.x, clamp(-this.vel.y * 0.04, -0.6, 0.6), 4, dt);
    } else {
      let st = this.state;
      if (st === 'ground' && this.carrying) st = 'carry';
      if (st === 'fly') st = 'air';
      animateHumanoid(m, { state: st, speed: this.speedNow, t: this.animT, swing: this.swing, climbMoving: this.climbMoving }, dt);
    }
    // 무적 시간 깜빡임
    m.root.visible = !(this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0);
    if (m.hook) {
      const g = m.hook.userData.glow;
      g.material.emissiveIntensity = 0.5 + Math.sin(this.animT * 3) * 0.3;
    }
    this.syncMesh();
  }
}
