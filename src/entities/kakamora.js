// 카카모라: 코코넛 갑옷의 꼬마 해적들
// 해적선이 배를 쫓아와 갑판에 올라타고, 헤이헤이를 훔쳐 가려고 한다.
import * as THREE from 'three';
import { mat, part } from './models.js';
import { kakamoraFaceTexture, thatchTexture } from '../textures.js';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/ocean.js';
import { DECK } from './boat.js';
import { ZONES, ISLANDS } from '../config.js';
import { approachAngle, clamp } from '../util.js';
import { bakeHierarchy } from '../world/bake.js';

function buildKakamora(variant) {
  const g = new THREE.Group();
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshStandardMaterial({ map: kakamoraFaceTexture(variant), flatShading: true, roughness: 0.9 }));
  nut.position.y = 0.72;
  nut.rotation.y = -Math.PI / 2;
  nut.castShadow = true;
  g.add(nut);
  // 머리 위 코코넛 섬유
  for (let i = 0; i < 5; i++) {
    const t = part('cone', mat('#4a3018'), 0.06, 0.3, 0.06, (i - 2) * 0.08, 1.15, -0.05, g);
    t.rotation.z = (i - 2) * 0.2;
  }
  const legs = [];
  for (const x of [-0.14, 0.14]) {
    const l = new THREE.Group(); l.position.set(x, 0.35, 0);
    part('cyl', mat('#2a1a10'), 0.05, 0.35, 0.05, 0, -0.17, 0, l);
    g.add(l); legs.push(l);
  }
  const arms = [];
  for (const x of [-0.42, 0.42]) {
    const a = new THREE.Group(); a.position.set(x, 0.75, 0);
    part('cyl', mat('#2a1a10'), 0.04, 0.35, 0.04, 0, -0.17, 0, a);
    g.add(a); arms.push(a);
  }
  // 작은 창
  const spear = part('cyl', mat('#8a6a40'), 0.025, 1.3, 0.025, 0.1, -0.2, 0.2, arms[1]);
  spear.rotation.x = 0.4;
  g.userData = { legs, arms };
  bakeHierarchy(g);
  return g;
}

function buildRaft() {
  const g = new THREE.Group();
  const hullMat = mat('#6b4526');
  const hull = part('sphere', hullMat, 1.6, 0.6, 3.4, 0, -0.1, 0, g);
  hull.scale.set(1.6, 0.6, 3.4);
  part('box', mat('#8a6a40'), 2.6, 0.15, 5, 0, 0.35, 0, g);
  // 코코넛 장식
  for (let i = 0; i < 6; i++) part('sphere', mat('#5a3a1c'), 0.3, 0.3, 0.3, (i % 2 ? 1 : -1) * 1.3, 0.5, -2 + (i >> 1) * 2, g);
  part('cyl', mat('#4a3018'), 0.08, 5, 0.08, 0, 2.8, 0.4, g);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.4), new THREE.MeshStandardMaterial({ map: thatchTexture(), side: THREE.DoubleSide, color: '#b08a50' }));
  sail.position.set(0, 3.2, 0.2);
  sail.castShadow = true;
  g.add(sail);
  // 해골 대신 코코넛 얼굴 깃발
  const flag = part('sphere', new THREE.MeshStandardMaterial({ map: kakamoraFaceTexture(3) }), 0.4, 0.4, 0.1, 0, 5.4, 0.4, g);
  flag.rotation.y = -Math.PI / 2;
  bakeHierarchy(g);
  return g;
}

export class Kakamora {
  constructor(game) {
    this.game = game;
    this.boats = [];
    this.boarders = [];
    this.sunk = 0;
    this.active = false;
    this.friendly = null;
    game.combat.register({
      projectile: (pos) => this.hitByProjectile(pos),
      melee: (pos, power, who) => this.hitByMelee(pos, power, who),
    });
    game.events.on('boatBump', () => {});
  }

  startRaid() {
    if (this.active || this.done) return;
    this.active = true;
    const b = this.game.boat;
    for (let i = 0; i < 5; i++) {
      const a = b.yaw + Math.PI * 0.35 + (i / 5) * Math.PI * 1.3;
      const d = 180 + i * 30;
      this.spawnBoat(b.x + Math.sin(a) * d, b.z + Math.cos(a) * d);
    }
    this.game.audio.play('drum');
  }

  spawnBoat(x, z) {
    const mesh = buildRaft();
    const crew = [];
    for (let k = 0; k < 3; k++) {
      const km = buildKakamora(Math.floor(Math.random() * 6));
      km.position.set((k - 1) * 0.8, 0.45, -1 + k * 0.7);
      mesh.add(km);
      crew.push(km);
    }
    const boat = { mesh, crew, x, z, yaw: 0, speed: 0, hp: 2, state: 'chase', boardTimer: 2 + Math.random() * 2, carrying: null, fleeT: 0, sinkT: 0 };
    mesh.position.set(x, 0, z);
    this.game.scene.add(mesh);
    this.boats.push(boat);
    return boat;
  }

  sinkBoat(bt) {
    if (bt.state === 'sinking') return;
    bt.state = 'sinking';
    bt.sinkT = 0;
    this.sunk++;
    const g = this.game;
    g.effects.splash(bt.mesh.position.clone().setY(1), 2);
    g.effects.sparkle(bt.mesh.position.clone().setY(2), 'gold', 20);
    g.audio.play('crash');
    g.hud.toast(`💥 카카모라 해적선 격파! (${Math.min(this.sunk, 4)}/4)`);
    if (bt.carrying) {
      const h = bt.carrying;
      bt.carrying = null;
      h.state = 'wander';
      g.scene.add(h.mesh);
      h.setWorld(bt.mesh.position.clone().setY(1));
      g.rescue.start(h, { style: 'gentle' });
      g.hud.toast('헤이헤이를 되찾았어요! 🐔');
    }
    // 이 배에서 올라탔던 해적들도 도망
    for (const bd of this.boarders) if (bd.home === bt) this.knockOff(bd);
  }

  hitByProjectile(pos) {
    for (const bd of this.boarders) {
      if (bd.state === 'gone') continue;
      const wp = bd.mesh.getWorldPosition(new THREE.Vector3());
      if (wp.distanceTo(pos) < 1.3) { this.knockOff(bd); return true; }
    }
    for (const bt of this.boats) {
      if (bt.state === 'sinking') continue;
      if (Math.hypot(bt.x - pos.x, bt.z - pos.z) < 3.5 && pos.y < 5) {
        bt.hp--;
        this.game.audio.play('bonk');
        if (bt.hp <= 0) this.sinkBoat(bt);
        return true;
      }
    }
    return false;
  }

  hitByMelee(pos, power, who) {
    let hit = false;
    for (const bd of this.boarders) {
      if (bd.state === 'gone') continue;
      const wp = bd.mesh.getWorldPosition(new THREE.Vector3());
      if (wp.distanceTo(pos) < 2.4 + power * 0.3) { this.knockOff(bd); hit = true; }
    }
    const reach = who.kind === 'maui' ? (who.hasHook ? 10 : 6) : 4;
    for (const bt of this.boats) {
      if (bt.state === 'sinking') continue;
      if (Math.hypot(bt.x - pos.x, bt.z - pos.z) < reach) { bt.hp -= power >= 2 ? 2 : 1; this.game.audio.play('bonk'); if (bt.hp <= 0) this.sinkBoat(bt); hit = true; }
    }
    return hit;
  }

  knockOff(bd) {
    if (bd.state === 'gone') return;
    const g = this.game;
    const wp = bd.mesh.getWorldPosition(new THREE.Vector3());
    if (bd.carrying) {
      const h = bd.carrying;
      bd.carrying = null;
      h.state = 'wander';
      h.mesh.visible = true;
      g.scene.add(h.mesh);
      h.setWorld(wp.clone());
      g.rescue.start(h, { style: 'gentle' });
    }
    bd.state = 'gone';
    g.scene.add(bd.mesh);
    bd.mesh.position.copy(wp);
    bd.fly = new THREE.Vector3((Math.random() - 0.5) * 8, 8, (Math.random() - 0.5) * 8);
    bd.flyT = 1.2;
    g.audio.play('bonk');
  }

  update(dt, t) {
    const g = this.game;
    const pb = g.boat;
    // 퀘스트 중 구역 안에 들어오면 습격 시작
    if (g.quests.is('kakamora') && !this.active && !this.done && g.leader.onBoat) {
      const z = ZONES.kakamora;
      if (Math.hypot(pb.x - z.x, pb.z - z.z) < z.r) {
        this.startRaid();
        g.dialog.show(g.lines.kakamoraStart);
      }
    }
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const bt = this.boats[i];
      if (bt.state === 'sinking') {
        bt.sinkT += dt;
        bt.mesh.position.y -= dt * 1.5;
        bt.mesh.rotation.z += dt * 0.6;
        if (bt.sinkT > 3) { g.scene.remove(bt.mesh); this.boats.splice(i, 1); }
        continue;
      }
      const dx = pb.x - bt.x, dz = pb.z - bt.z;
      const d = Math.hypot(dx, dz);
      let want = Math.atan2(dx, dz), sp = 19;
      if (bt.state === 'flee' || bt.state === 'leave') {
        want += Math.PI; sp = 22;
        bt.fleeT += dt;
        if (bt.fleeT > 30 || d > 700) {
          if (bt.carrying) {
            const h = bt.carrying; bt.carrying = null;
            h.state = 'wander'; h.mesh.visible = true;
            g.scene.add(h.mesh);
            h.setWorld(new THREE.Vector3(bt.x, 1, bt.z));
            g.rescue.start(h, { style: 'gentle' });
            g.hud.toast('헤이헤이가 스스로 바다에 뛰어들었고, 바다가 돌려줬어요! 🌊🐔');
          }
          g.scene.remove(bt.mesh); this.boats.splice(i, 1); continue;
        }
      } else if (d < 9) { sp = Math.max(0, pb.speed * 0.95); }
      bt.yaw = approachAngle(bt.yaw, want, dt * 1.4);
      bt.speed += (sp - bt.speed) * dt * 0.8;
      let nx = bt.x + Math.sin(bt.yaw) * bt.speed * dt, nz = bt.z + Math.cos(bt.yaw) * bt.speed * dt;
      if (heightAt(nx, nz) > -1.5) { bt.yaw += dt * 2; nx = bt.x; nz = bt.z; }
      // 배끼리 부딪힘: 빠르게 들이받으면 격침
      if (d < 7.5) {
        if (Math.abs(pb.speed) > 9 && bt.state !== 'flee') this.sinkBoat(bt);
        else { nx -= (dx / d) * 3 * dt; nz -= (dz / d) * 3 * dt; }
      }
      bt.x = nx; bt.z = nz;
      bt.mesh.position.set(bt.x, waveHeight(bt.x, bt.z, t) + 0.2, bt.z);
      bt.mesh.rotation.set(Math.sin(t * 2 + i) * 0.05, bt.yaw, Math.cos(t * 1.7 + i) * 0.06);
      for (const km of bt.crew) {
        if (km.parent !== bt.mesh) continue;
        km.position.y = 0.45 + Math.abs(Math.sin(t * 8 + km.id)) * 0.15;
        km.userData.arms[1].rotation.x = -1.5 + Math.sin(t * 6 + km.id) * 0.5;
      }
      // 올라타기
      if (bt.state === 'chase' && d < 16) {
        bt.boardTimer -= dt;
        if (bt.boardTimer <= 0 && this.boarders.filter((b) => b.state !== 'gone').length < 4) {
          bt.boardTimer = 3 + Math.random() * 2;
          const km = bt.crew.find((c) => c.parent === bt.mesh);
          if (km) this.board(bt, km);
        }
      }
    }
    this.updateBoarders(dt, t);

    if (this.active && g.quests.is('kakamora') && this.sunk >= 4) {
      this.active = false;
      this.done = true;
      for (const bt of this.boats) if (bt.state !== 'sinking') bt.state = 'leave';
      g.dialog.show(g.lines.kakamoraDone, () => g.quests.advance('kakamora'));
    }
    this.updateFriendly(dt, t);
  }

  board(bt, km) {
    const g = this.game;
    const start = km.getWorldPosition(new THREE.Vector3());
    g.scene.add(km);
    km.position.copy(start);
    const target = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 8);
    this.boarders.push({ mesh: km, home: bt, state: 'jump', t: 0, start, target, local: new THREE.Vector3(), carrying: null, hitCd: 0 });
    g.audio.play('jump');
  }

  updateBoarders(dt, t) {
    const g = this.game;
    const pb = g.boat;
    for (let i = this.boarders.length - 1; i >= 0; i--) {
      const bd = this.boarders[i];
      const m = bd.mesh;
      if (bd.state === 'gone') {
        bd.flyT -= dt;
        bd.fly.y -= 20 * dt;
        m.position.addScaledVector(bd.fly, dt);
        m.rotation.x += dt * 10;
        if (bd.flyT <= 0) {
          g.effects.splash(m.position.clone(), 0.6);
          g.scene.remove(m);
          this.boarders.splice(i, 1);
        }
        continue;
      }
      if (bd.state === 'jump') {
        bd.t += dt / 0.9;
        const dst = pb.root.localToWorld(bd.target.clone());
        m.position.lerpVectors(bd.start, dst, Math.min(1, bd.t));
        m.position.y += Math.sin(Math.min(1, bd.t) * Math.PI) * 5;
        if (bd.t >= 1) {
          bd.state = 'deck';
          pb.root.add(m);
          bd.local.copy(bd.target);
          m.position.copy(bd.local);
        }
        continue;
      }
      if (bd.state === 'return') {
        bd.t += dt / 1.0;
        const home = bd.home;
        const dst = new THREE.Vector3(home.x, 1, home.z);
        m.position.lerpVectors(bd.start, dst, Math.min(1, bd.t));
        m.position.y += Math.sin(Math.min(1, bd.t) * Math.PI) * 5;
        if (bd.t >= 1) {
          if (home.state === 'sinking' || !this.boats.includes(home)) { this.knockOff(bd); continue; }
          home.mesh.add(m);
          m.position.set(0, 0.45, 1.5);
          home.crew.push(m);
          if (bd.carrying) {
            home.carrying = bd.carrying;
            home.state = 'flee';
            home.fleeT = 0;
            g.hud.toast('😱 카카모라가 헤이헤이를 데려가요! 해적선을 쫓아가서 부숴요!');
          }
          this.boarders.splice(i, 1);
        }
        continue;
      }
      // 갑판 위: 헤이헤이 또는 가장 가까운 캐릭터에게
      const hh = g.heihei;
      let tgt = null, grabbing = false;
      if (!bd.carrying && hh.onBoat && hh.state !== 'inBox' && hh.state !== 'carried' && hh.state !== 'rescue') { tgt = hh.pos; grabbing = true; }
      else if (!bd.carrying) {
        let best = Infinity;
        for (const c of g.characters) {
          if (!c.onBoat) continue;
          const dd = c.pos.distanceTo(bd.local);
          if (dd < best) { best = dd; tgt = c.pos; }
        }
      }
      if (bd.carrying) {
        // 뱃전으로 가서 뛰어내리기
        const side = bd.local.x >= 0 ? 1 : -1;
        tgt = new THREE.Vector3(side * (DECK.halfW + 0.2), 0, bd.local.z);
      }
      if (tgt) {
        const dx = tgt.x - bd.local.x, dz = tgt.z - bd.local.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.5) {
          bd.local.x += (dx / d) * 3.2 * dt;
          bd.local.z += (dz / d) * 3.2 * dt;
          m.rotation.y = approachAngle(m.rotation.y, Math.atan2(dx, dz), dt * 8);
        }
        if (grabbing && d < 0.7) {
          bd.carrying = hh;
          hh.state = 'stolen';
          m.add(hh.mesh);
          hh.mesh.position.set(0, 1.2, 0);
          g.audio.play('bok');
          g.hud.toast('🐔 헤이헤이가 잡혔어요! 해적을 때려서 구해요!');
        } else if (!grabbing && !bd.carrying && d < 1.0) {
          bd.hitCd -= dt;
          if (bd.hitCd <= 0) {
            bd.hitCd = 1.5;
            const c = g.characters.find((ch) => ch.pos === tgt);
            if (c) c.damage(1, m.getWorldPosition(new THREE.Vector3()));
          }
        }
        if (bd.carrying && Math.abs(bd.local.x) >= DECK.halfW - 0.1) {
          bd.state = 'return';
          bd.t = 0;
          bd.start = m.getWorldPosition(new THREE.Vector3());
          g.scene.add(m);
          m.position.copy(bd.start);
          continue;
        }
      }
      bd.local.x = clamp(bd.local.x, -DECK.halfW, DECK.halfW);
      bd.local.z = clamp(bd.local.z, -DECK.halfL, DECK.halfL);
      m.position.copy(bd.local);
      m.position.y = pb.deckHeight(bd.local.x, bd.local.z) + Math.abs(Math.sin(t * 12)) * 0.12;
      const u = m.userData;
      u.legs[0].rotation.x = Math.sin(t * 14) * 0.7; u.legs[1].rotation.x = -Math.sin(t * 14) * 0.7;
    }
  }

  // 2장: 친구가 된 카카모라 (코코넛 선물)
  setupFriendly() {
    if (this.friendly) return;
    const rock = ISLANDS.find((i) => i.id === 'kakamora_rock');
    const bt = this.spawnBoat(rock.x + 90, rock.z + 20);
    this.boats.pop();
    bt.state = 'friendly';
    this.friendly = bt;
    const g = this.game;
    g.addInteractable({
      pos: new THREE.Vector3(bt.x, 0, bt.z), radius: 14,
      getPos: () => new THREE.Vector3(bt.x, 0, bt.z),
      label: () => '🥥 친구 카카모라 코투에게 코코넛 받기',
      action: () => {
        g.inventory.coconut += 3;
        g.audio.play('pickup');
        g.hud.toast('코투: 쿠쿠! (코코넛 +3 🥥)');
      },
    });
  }

  updateFriendly(dt, t) {
    const bt = this.friendly;
    if (!bt) return;
    bt.mesh.position.set(bt.x, waveHeight(bt.x, bt.z, t) + 0.2, bt.z);
    bt.mesh.rotation.set(Math.sin(t * 2) * 0.05, t * 0.1, 0);
    for (const km of bt.crew) km.position.y = 0.45 + Math.abs(Math.sin(t * 5 + km.id)) * 0.25;
  }

  clear() {
    for (const bt of this.boats) this.game.scene.remove(bt.mesh);
    for (const bd of this.boarders) bd.mesh.parent?.remove(bd.mesh);
    this.boats = []; this.boarders = []; this.active = false;
  }
}
