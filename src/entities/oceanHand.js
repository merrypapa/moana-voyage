// 살아있는 바다: 물에 빠진 캐릭터를 물기둥으로 들어 배(또는 해변)로 데려다줌
import * as THREE from 'three';
import { findShorePoint } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { smoothstep, lerp } from '../util.js';

const DECK_SPOTS = {
  moana: new THREE.Vector3(0.9, 0, -1.4),
  maui: new THREE.Vector3(-1.2, 0, 3.0),
  heihei: new THREE.Vector3(-1.0, 0, -2.2),
  pua: new THREE.Vector3(1.0, 0, 2.6),
};

export class OceanRescue {
  constructor(game) {
    this.game = game;
    this.active = [];
    this.mat = new THREE.MeshStandardMaterial({
      color: '#44c8ee', emissive: '#0f5f80', emissiveIntensity: 0.6, transparent: true, opacity: 0.78,
      roughness: 0.05, metalness: 0.1, flatShading: false,
    });
    this.blobGeo = new THREE.IcosahedronGeometry(1, 2);
  }

  isRescuing(e) { return this.active.some((r) => r.entity === e); }

  // to: 'boat' | THREE.Vector3(월드) | undefined(자동: 배가 가까우면 배, 아니면 해변)
  start(entity, { style = 'gentle', to } = {}) {
    if (this.isRescuing(entity)) return;
    const g = this.game;
    if (entity.state === 'helm' && entity.leaveHelm) entity.leaveHelm();
    if (entity.climb) entity.climb = null;
    if (entity.form === 'hawk') entity.toggleHawk?.();
    if (entity.carrying) entity.dropCarried?.();
    const start = entity.worldPos(new THREE.Vector3());
    entity.setWorld(start);
    entity.state = 'rescue';
    const boat = g.boat;
    let dest;
    const boatOk = boat.unlocked && g.zone === 'surface';
    if (to === 'boat' && boatOk) {
      dest = { boat: true, local: (DECK_SPOTS[entity.kind] || DECK_SPOTS.moana).clone() };
    } else if (to && to.isVector3) {
      dest = { boat: false, world: to.clone() };
    } else if (boatOk && Math.hypot(start.x - boat.x, start.z - boat.z) < 900) {
      dest = { boat: true, local: (DECK_SPOTS[entity.kind] || DECK_SPOTS.moana).clone() };
    } else {
      const sp = findShorePoint(start.x, start.z) || { x: 0, y: 4, z: 60 };
      dest = { boat: false, world: new THREE.Vector3(sp.x, sp.y, sp.z) };
    }
    const destW = dest.boat ? boat.root.localToWorld(dest.local.clone()) : dest.world;
    const leapT = Math.min(2.4, Math.max(0.7, start.distanceTo(destW) / 14));
    const r = {
      entity, style, dest, t: 0,
      start: start.clone(),
      riseT: style === 'toss' ? 0.5 : style === 'leap' ? 0 : 1.0,
      carryT: style === 'toss' ? 1.1 : style === 'leap' ? leapT : 1.9,
      mesh: null, blob: null, apex: 0,
    };
    if (style !== 'leap') {
      r.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
      r.mesh.frustumCulled = false;
      r.blob = new THREE.Mesh(this.blobGeo, this.mat);
      g.scene.add(r.mesh, r.blob);
      g.audio.play('wave');
      if (entity.kind === 'moana' && !g.flags.firstRescue) {
        g.flags.firstRescue = true;
        g.hud.toast('바다가 모아나를 구해줬어요! 🌊💙');
      } else if (entity.kind === 'maui' && style === 'toss') {
        g.hud.toast('바다가 마우이를 배 위로 던졌어요! 😂');
      }
    }
    this.active.push(r);
  }

  destWorld(r, out) {
    if (r.dest.boat) return this.game.boat.root.localToWorld(out.copy(r.dest.local));
    return out.copy(r.dest.world);
  }

  update(dt) {
    const g = this.game;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const r = this.active[i];
      r.t += dt;
      const e = r.entity;
      const dst = this.destWorld(r, new THREE.Vector3());
      const sea = waveHeight(r.start.x, r.start.z, g.time);
      const pos = new THREE.Vector3();
      let baseP;
      if (r.t < r.riseT) {
        const k = smoothstep(0, 1, r.t / r.riseT);
        pos.copy(r.start).setY(lerp(r.start.y, sea + 4.5, k));
        baseP = new THREE.Vector3(r.start.x, sea - 1, r.start.z);
      } else {
        const k = Math.min(1, (r.t - r.riseT) / r.carryT);
        const kk = k * k * (3 - 2 * k);
        const from = new THREE.Vector3(r.start.x, sea + 4.5, r.start.z);
        if (r.style === 'leap') from.copy(r.start);
        pos.lerpVectors(from, dst, kk);
        const arc = r.style === 'toss' ? 10 : r.style === 'leap' ? 8 : 5;
        pos.y += Math.sin(k * Math.PI) * arc;
        baseP = new THREE.Vector3().lerpVectors(new THREE.Vector3(r.start.x, 0, r.start.z), dst, Math.min(kk, 0.75));
        baseP.y = waveHeight(baseP.x, baseP.z, g.time) - 1;
        if (k >= 1) {
          this.finish(r);
          this.active.splice(i, 1);
          continue;
        }
      }
      e.pos.copy(pos);
      e.vel.set(0, 0, 0);
      if (r.style === 'toss') e.facing += dt * 14;
      e.syncMesh?.();
      if (r.mesh) this.shapeTentacle(r, baseP, pos);
    }
    // 물러나는 물기둥
    for (const f of (this.fading ||= [])) {
      f.life -= dt;
      const s = Math.max(0.01, f.life / 0.7);
      f.mesh.scale.set(s, s, s);
      f.blob.scale.multiplyScalar(0.9);
      if (f.life <= 0) {
        g.scene.remove(f.mesh, f.blob);
        f.mesh.geometry.dispose();
      }
    }
    this.fading = this.fading.filter((f) => f.life > 0);
  }

  shapeTentacle(r, base, tip) {
    const t = this.game.time;
    const mid1 = base.clone().lerp(tip, 0.35); mid1.y = lerp(base.y, tip.y, 0.5) + Math.sin(t * 3) * 0.4;
    mid1.x += Math.sin(t * 2.3) * 0.6;
    const mid2 = base.clone().lerp(tip, 0.7); mid2.y = tip.y - 0.8;
    mid2.z += Math.cos(t * 2.1) * 0.5;
    const curve = new THREE.CatmullRomCurve3([base, mid1, mid2, tip.clone().setY(tip.y - 0.4)]);
    const radius = r.style === 'toss' ? 0.8 : 1.1;
    const geo = new THREE.TubeGeometry(curve, 24, radius, 10, false);
    // 아래는 두껍고 위는 가늘게
    const p = geo.attributes.position;
    const pts = curve.getSpacedPoints(24);
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 11);
      const c = pts[Math.min(seg, 24)];
      const k = 1.6 - (seg / 24) * 0.9;
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
    }
    geo.computeVertexNormals();
    r.mesh.geometry.dispose();
    r.mesh.geometry = geo;
    r.blob.position.copy(tip).setY(tip.y - 0.1);
    r.blob.scale.setScalar(0.9 + Math.sin(t * 6) * 0.08);
  }

  finish(r) {
    const e = r.entity;
    const g = this.game;
    if (r.dest.boat) {
      e.placeOnBoat(r.dest.local.clone());
    } else {
      e.setWorld(r.dest.world);
      e.grounded = true;
    }
    e.state = e.kind === 'heihei' || e.kind === 'pua' ? 'wander' : 'ground';
    if (e.kind === 'heihei' || e.kind === 'pua') { e.target = null; e.timer = 1; }
    e.inWater = false;
    if (r.mesh) {
      this.fading ||= [];
      this.fading.push({ mesh: r.mesh, blob: r.blob, life: 0.7 });
      g.effects.splash(r.dest.boat ? g.boat.root.localToWorld(r.dest.local.clone()) : r.dest.world, 0.6);
    }
    g.events.emit('rescued', e);
  }
}
