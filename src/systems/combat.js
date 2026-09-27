// 전투: 코코넛 던지기, 근접 공격 판정
import * as THREE from 'three';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { mat } from '../entities/models.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.targets = []; // { hit(pos, kind, who) => bool }
    this.nutGeo = new THREE.IcosahedronGeometry(0.28, 0);
  }

  register(t) { this.targets.push(t); }

  throwCoconut(who) {
    const g = this.game;
    const p = who.worldPos(new THREE.Vector3());
    p.y += 1.5;
    const yaw = who.worldYaw();
    const m = new THREE.Mesh(this.nutGeo, mat('#6b4a1c'));
    m.position.copy(p);
    g.scene.add(m);
    const v = new THREE.Vector3(Math.sin(yaw) * 24, 7, Math.cos(yaw) * 24);
    if (who.onBoat) {
      v.x += Math.sin(g.boat.yaw) * g.boat.speed;
      v.z += Math.cos(g.boat.yaw) * g.boat.speed;
    }
    this.projectiles.push({ m, v, life: 3, who });
  }

  melee(who) {
    const g = this.game;
    const p = who.worldPos(new THREE.Vector3());
    const yaw = who.worldYaw();
    const front = p.clone().add(new THREE.Vector3(Math.sin(yaw) * 1.5, 1, Math.cos(yaw) * 1.5));
    const power = who.kind === 'maui' ? (who.hasHook ? 3 : 2) : 1;
    if (who.kind === 'maui' && who.hasHook) {
      g.effects.sparkle(front, 'spark', 20);
      g.effects.shake = Math.max(g.effects.shake, 0.25);
    }
    for (const t of this.targets) if (t.melee && t.melee(front, power, who)) break;
    g.events.emit('melee', { who, pos: front, power });
  }

  update(dt) {
    const g = this.game;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.v.y -= 18 * dt;
      pr.m.position.addScaledVector(pr.v, dt);
      pr.m.rotation.x += dt * 10;
      const pos = pr.m.position;
      let done = pr.life <= 0;
      for (const t of this.targets) {
        if (t.projectile && t.projectile(pos, pr.who)) { done = true; g.effects.sparkle(pos, 'gold', 10); break; }
      }
      if (!done) {
        const floor = Math.max(heightAt(pos.x, pos.z), g.zone === 'surface' ? waveHeight(pos.x, pos.z, g.time) : -1e9);
        if (pos.y < floor) {
          done = true;
          if (floor > heightAt(pos.x, pos.z)) g.effects.splash(pos, 0.5);
        }
      }
      if (done) {
        g.scene.remove(pr.m);
        this.projectiles.splice(i, 1);
      }
    }
  }
}
