// 특별한 장소: 마우이의 섬, 괴물의 섬(랄로타이 입구), 카카모라 암초, 테 피티
import * as THREE from 'three';
import { ISLANDS } from '../config.js';
import { heightAt } from './terrain.js';
import { mat, part } from '../entities/models.js';
import { bakeInto } from './bake.js';

const I = (id) => ISLANDS.find((i) => i.id === id);

export class Locations {
  constructor(game) {
    this.game = game;
    this.decor = new THREE.Group();
    game.scene.add(this.decor);
    this.buildMauiIsland();
    this.buildSpire();
    this.buildKakamoraRock();
    this.buildTeFitiMarks();
    bakeInto(this.decor);
  }

  buildMauiIsland() {
    const isl = I('maui');
    const g = this.game;
    // 마우이 동굴: 벽에 날짜를 센 자국
    const cx = isl.x + 25, cz = isl.z - 18;
    const cave = new THREE.Group();
    part('sphere', mat('#6d665e'), 9, 7, 7, 0, 3, 0, cave);
    const marks = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: '#2a2522' }));
    marks.position.set(0, 3, 6.9);
    cave.add(marks);
    for (let i = 0; i < 24; i++) part('box', mat('#e8dcc0'), 0.08, 1 + (i % 5 === 4 ? 0 : 0), 0.02, -2.6 + i * 0.22, 3, 6.95, cave).rotation.z = i % 5 === 4 ? 1.1 : 0;
    cave.position.set(cx, heightAt(cx, cz) - 1, cz);
    cave.rotation.y = Math.PI * 0.9;
    this.decor.add(cave);
    // 마우이 석상
    const sx = isl.x - 30, sz = isl.z + 40;
    const statue = new THREE.Group();
    part('box', mat('#7a6a5a'), 2.2, 4, 1.6, 0, 2, 0, statue);
    part('sphere', mat('#7a6a5a'), 1.4, 1.5, 1.2, 0, 4.8, 0, statue);
    part('box', mat('#3a302a'), 1.2, 0.25, 0.1, 0, 4.4, 1.15, statue);
    for (const x of [-0.5, 0.5]) part('sphere', mat('#3a302a'), 0.25, 0.25, 0.1, x, 5.1, 1.15, statue);
    statue.position.set(sx, heightAt(sx, sz), sz);
    this.decor.add(statue);
    this.mauiSpawn = new THREE.Vector3(isl.x + 5, 0, isl.z + 70);
    this.mauiSpawn.y = heightAt(this.mauiSpawn.x, this.mauiSpawn.z);
    // 마우이 해변이 너무 깊으면 안쪽으로
    for (let k = 0; k < 60 && this.mauiSpawn.y < 1; k++) {
      this.mauiSpawn.z -= 2;
      this.mauiSpawn.y = heightAt(this.mauiSpawn.x, this.mauiSpawn.z);
    }
  }

  buildSpire() {
    const isl = I('lalotai');
    const g = this.game;
    // 남쪽 절벽을 따라 오르는 길
    let rBase = 60;
    for (let r = 60; r > 20; r -= 0.5) { if (heightAt(isl.x, isl.z + r) > 8) { rBase = r + 1.5; break; } }
    let rTop = 10;
    const topH = heightAt(isl.x, isl.z);
    for (let r = 10; r < 60; r += 0.5) { if (heightAt(isl.x, isl.z + r) < topH - 6) { rTop = r - 0.5; break; } }
    const a = new THREE.Vector3(isl.x, heightAt(isl.x, isl.z + rBase), isl.z + rBase);
    const b = new THREE.Vector3(isl.x, heightAt(isl.x, isl.z + rTop) + 0.5, isl.z + rTop + 1.5);
    this.spireBase = a.clone();
    this.spireTop = new THREE.Vector3(isl.x, topH, isl.z);
    // 덩굴 (오르는 길 표시)
    const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, a.distanceTo(b), 6), mat('#2f7a34'));
    vine.position.copy(a).add(b).multiplyScalar(0.5);
    vine.lookAt(b);
    vine.rotateX(Math.PI / 2);
    this.decor.add(vine);
    for (let k = 0; k < 30; k++) {
      const p = a.clone().lerp(b, k / 30);
      part('sphere', mat('#3f9a3a'), 0.6, 0.4, 0.6, p.x + (k % 2 ? 0.5 : -0.5), p.y, p.z + 0.2, this.decor);
    }
    const climbable = { kind: 'spire', a, b, exitTop: new THREE.Vector3(isl.x, 0, isl.z + rTop - 6), speed: 10, offset: 0.9 };
    g.climbables.push(climbable);
    g.addInteractable({
      pos: a.clone(), radius: 4,
      label: () => '🧗 절벽 오르기 (앞으로 = 위로)',
      enabled: (c) => c.form !== 'hawk',
      action: (c) => c.startClimb(climbable),
    });
    // 꼭대기 입구
    const portal = new THREE.Mesh(new THREE.TorusGeometry(4, 0.6, 8, 24), new THREE.MeshStandardMaterial({ color: '#b070ff', emissive: '#8040ff', emissiveIntensity: 1.2 }));
    portal.rotation.x = Math.PI / 2;
    portal.position.copy(this.spireTop).setY(topH + 0.5);
    g.scene.add(portal);
    this.portal = portal;
    g.addInteractable({
      pos: this.spireTop.clone(), radius: 8,
      label: () => (g.quests.atLeast('lalotai') ? '🌀 괴물의 세계로 뛰어들기' : '🌀 이상한 구멍… (아직은 무서워요)'),
      action: () => {
        if (!g.quests.atLeast('lalotai')) { g.hud.toast('마우이와 함께 와야 할 것 같아요.'); return; }
        if (g.flags.hookFound) { g.hud.toast('이미 갈고리를 찾았어요!'); return; }
        g.dialog.show(g.lines.spireTop, () => g.lalotai.enter());
      },
    });
  }

  buildKakamoraRock() {
    const isl = I('kakamora_rock');
    for (let i = 0; i < 12; i++) {
      const a = i * 0.7, r = 12 + (i % 3) * 5;
      const x = isl.x + Math.sin(a) * r, z = isl.z + Math.cos(a) * r;
      part('sphere', mat('#5a3a1c'), 0.6, 0.6, 0.6, x, heightAt(x, z) + 0.5, z, this.decor);
    }
  }

  buildTeFitiMarks() {
    // 테 피티 섬 위에서 보이는 나선 모양 돌길
    const isl = I('tefiti');
    for (let i = 0; i < 90; i++) {
      const t = i / 90;
      const a = t * Math.PI * 6;
      const r = 8 + t * 110;
      const x = isl.x + Math.cos(a) * r, z = isl.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 0.5) continue;
      part('sphere', mat('#9a948a'), 1.4, 0.5, 1.4, x, h + 0.2, z, this.decor);
    }
  }

  update(dt, t) {
    if (this.portal) this.portal.rotation.z += dt;
  }
}

// 탈라 할머니의 영혼: 빛나는 가오리가 목표 방향으로 헤엄친다
export class Manta {
  constructor(game) {
    this.game = game;
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#6ad8ff', emissive: '#2aa8ff', emissiveIntensity: 1.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide, flatShading: true });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 1.6, -2.4, 0, -0.4, 0, 0.2, -0.6, 0, 0, 1.6, 0, 0.2, -0.6, 2.4, 0, -0.4, 0, 0.2, -0.6, -0.15, 0, -3, 0.15, 0, -3], 3));
    geo.computeVertexNormals();
    this.body = new THREE.Mesh(geo, m);
    g.add(this.body);
    g.scale.setScalar(1.3);
    this.mesh = g;
    this.mesh.visible = false;
    this.pos = new THREE.Vector3();
    this.alpha = 0;
    game.scene.add(g);
  }

  update(dt, t) {
    const g = this.game;
    const target = g.quests.target();
    const show = g.flags.talaSpirit && g.zone === 'surface' && g.leader.onBoat && target && g.boat.unlocked;
    const b = g.boat;
    let dist = 0;
    if (target) dist = Math.hypot(target.x - b.x, target.z - b.z);
    const want = show && dist > 120 ? 1 : 0;
    this.alpha += (want - this.alpha) * Math.min(1, dt * 1.5);
    this.mesh.visible = this.alpha > 0.02 && !!target;
    if (!this.mesh.visible) return;
    const dx = target.x - b.x, dz = target.z - b.z;
    const L = Math.hypot(dx, dz) || 1;
    const aheadX = b.x + (dx / L) * 28 + Math.sin(t * 0.7) * 3;
    const aheadZ = b.z + (dz / L) * 28 + Math.cos(t * 0.6) * 3;
    this.pos.set(aheadX, 0.3 + Math.sin(t * 2) * 0.3, aheadZ);
    this.mesh.position.lerp(this.pos, Math.min(1, dt * 3));
    this.mesh.rotation.set(0, Math.atan2(dx, dz), Math.sin(t * 3) * 0.2);
    this.body.material.opacity = 0.75 * this.alpha;
    this.body.scale.x = 1 + Math.sin(t * 4) * 0.15;
  }
}
