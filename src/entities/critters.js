// 헤이헤이(닭)와 푸아(돼지)
import * as THREE from 'three';
import { Body } from './body.js';
import { buildHeihei, buildPua, animateHeihei, animatePua } from './models.js';
import { BOX, DECK } from './boat.js';
import { heightAt } from '../world/terrain.js';
import { clamp } from '../util.js';

const tmp = new THREE.Vector3();

export class Critter extends Body {
  constructor(game, kind, prebuilt = null) {
    const model = prebuilt || (kind === 'heihei' ? buildHeihei() : buildPua());
    super(game, model.root, { radius: 0.3, stepMax: 0.6 });
    this.kind = kind;
    this.name = kind === 'heihei' ? '헤이헤이' : '푸아';
    this.model = model;
    this.state = 'wander';
    this.target = null;
    this.timer = 1;
    this.home = new THREE.Vector3();
    this.animT = Math.random() * 10;
    this.speedNow = 0;
    this.carrier = null;
    this.boxTimer = 0;
    this.nextBoxThink = 15 + Math.random() * 20;
  }

  get inBox() { return this.state === 'inBox'; }

  setCarried(who) {
    if (this.state === 'inBox') this.exitBox(false);
    this.state = 'carried';
    this.carrier = who;
    if (this.onBoat) { this.onBoat = false; }
    who.model.body.add(this.mesh);
    this.mesh.position.set(0, who.model.H * 1.02, 0.05);
    this.mesh.rotation.set(0, 0, 0);
  }

  release(onBoat, localPos, intoWater) {
    this.carrier = null;
    this.state = 'wander';
    this.timer = 1.5;
    this.vel.set(0, 0, 0);
    if (onBoat) {
      this.onBoat = false;
      localPos.x = clamp(localPos.x, -DECK.halfW + 0.2, DECK.halfW - 0.2);
      localPos.z = clamp(localPos.z, -DECK.halfL + 0.2, DECK.halfL - 0.2);
      this.placeOnBoat(localPos);
      this.pos.y = Math.max(localPos.y, this.boat.deckHeight(localPos.x, localPos.z));
    } else {
      this.onBoat = false;
      this.game.scene.add(this.mesh);
      this.pos.copy(localPos);
    }
    if (intoWater) this.game.rescue.start(this, { style: 'gentle' });
  }

  // 상자에 들어가기 / 나오기
  enterBox() {
    const b = this.boat;
    if (this.carrier) { this.carrier.carrying = null; this.carrier = null; }
    if (!this.onBoat || this.mesh.parent !== b.root) {
      this.onBoat = false;
      this.placeOnBoat(new THREE.Vector3(BOX.x, BOX.h, BOX.z));
    }
    this.state = 'inBox';
    this.mesh.visible = false;
    this.pos.set(BOX.x, BOX.h, BOX.z);
    b.box.heihei = true;
    b.box.target = 1;
    setTimeout(() => { if (b.box.heihei) b.box.target = 0; }, 600);
    this.boxTimer = 12 + Math.random() * 18;
    this.game.audio.play('bok');
    this.game.events.emit('heiheiBox', { inside: true });
  }

  exitBox(jump = true) {
    const b = this.boat;
    b.box.heihei = false;
    b.box.target = 1;
    setTimeout(() => { if (!b.box.heihei) b.box.target = 0; }, 1400);
    this.mesh.visible = true;
    this.state = 'wander';
    this.timer = 1;
    this.pos.set(BOX.x, BOX.h + 0.1, BOX.z);
    if (jump) {
      const a = Math.random() * Math.PI * 2;
      this.vel.set(Math.sin(a) * 1.5 - 1.2, 5, Math.cos(a) * 1.5);
    }
    this.game.audio.play('bok');
    this.game.events.emit('heiheiBox', { inside: false });
  }

  pickTarget() {
    const b = this.boat;
    const r = Math.random;
    if (this.onBoat) {
      if (this.kind === 'heihei' && r() < 0.12) {
        // 헤이헤이는 가끔 멍하게 배 밖으로 걸어간다...
        const side = r() < 0.5 ? -1 : 1;
        return new THREE.Vector3(side * (DECK.halfW + 1.5), 0, (r() - 0.5) * 6);
      }
      return new THREE.Vector3((r() - 0.5) * (DECK.halfW * 2 - 0.6), 0, (r() - 0.5) * (DECK.halfL * 2 - 0.6));
    }
    const a = r() * Math.PI * 2, d = 3 + r() * 14;
    return new THREE.Vector3(this.home.x + Math.sin(a) * d, 0, this.home.z + Math.cos(a) * d);
  }

  update(dt) {
    this.animT += dt;
    const s = this.state;
    if (s === 'carried' || s === 'rescue' || s === 'stolen' || s === 'frozen') {
      animateHeiheiOrPua(this, 'carried', 0);
      if (s !== 'carried' && s !== 'stolen') this.syncMesh();
      return;
    }
    if (s === 'inBox') {
      this.boxTimer -= dt;
      if (this.boxTimer <= 0) this.exitBox();
      return;
    }
    let wishX = 0, wishZ = 0, speed = this.kind === 'heihei' ? 1.5 : 2.2;
    const leader = this.game.leaderFor(this);
    if (this.kind === 'pua' && leader && !this.onBoat && !leader.onBoat) {
      const lp = leader.worldPos(tmp);
      const d = Math.hypot(lp.x - this.pos.x, lp.z - this.pos.z);
      if (d < 45 && d > 2.5 && heightAt(lp.x, lp.z) > 0.3) {
        this.target = lp.clone();
        speed = d > 6 ? 6 : 3;
        this.state = 'follow';
      } else if (this.state === 'follow') { this.state = 'wander'; this.target = null; this.timer = 2; }
    }
    if (this.kind === 'heihei' && this.onBoat && this.game.boat.unlocked) {
      this.nextBoxThink -= dt;
      if (this.nextBoxThink <= 0) {
        this.nextBoxThink = 20 + Math.random() * 30;
        if (Math.random() < 0.45 && !this.boat.box.heihei) {
          this.state = 'toBox';
          this.target = new THREE.Vector3(BOX.x - BOX.half - 0.4, 0, BOX.z);
        }
      }
    }
    if (this.state === 'wander' || this.state === 'peck') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (Math.random() < 0.35) { this.state = 'peck'; this.target = null; this.timer = 1.5 + Math.random() * 2; }
        else { this.state = 'wander'; this.target = this.pickTarget(); this.timer = 3 + Math.random() * 4; }
      }
    }
    if (this.target) {
      const cur = this.pos;
      const dx = this.target.x - cur.x, dz = this.target.z - cur.z;
      const d = Math.hypot(dx, dz);
      if (d < (this.state === 'toBox' ? 0.35 : 0.5)) {
        if (this.state === 'toBox') { this.enterBox(); return; }
        this.target = null;
      } else {
        // 목표는 현재 좌표계 기준. 월드 방향으로 변환해서 physics에 넘김
        let wx = (dx / d) * speed, wz = (dz / d) * speed;
        if (this.onBoat) {
          const b = this.boat, c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
          const lx = wx, lz = wz;
          wx = lx * c + lz * sn; wz = -lx * sn + lz * c;
        }
        wishX = wx; wishZ = wz;
      }
    }
    // 푸아는 배 밖으로 나가지 않는다
    if (this.kind === 'pua' && this.onBoat) {
      this.pos.x = clamp(this.pos.x, -DECK.halfW + 0.3, DECK.halfW - 0.3);
      this.pos.z = clamp(this.pos.z, -DECK.halfL + 0.3, DECK.halfL - 0.3);
    }
    this.physics(dt, wishX, wishZ, 20);
    if (Math.abs(wishX) + Math.abs(wishZ) > 0.01) this.faceToward(wishX, wishZ, dt, 8);
    this.speedNow = Math.hypot(wishX, wishZ);
    if (this.inWater) {
      this.game.audio.play('splash');
      this.game.effects.splash(this.worldPos(tmp));
      this.game.rescue.start(this, { style: 'gentle' });
      this.game.events.emit('critterOverboard', this);
    }
    animateHeiheiOrPua(this, this.state === 'peck' ? 'peck' : 'walk', this.speedNow);
    this.syncMesh();
  }
}

function animateHeiheiOrPua(c, state, speed) {
  if (c.kind === 'heihei') animateHeihei(c.model, { t: c.animT, speed, state });
  else animatePua(c.model, { t: c.animT, speed });
}
