// 월드 조립: 섬 지형 + 식생 + 암초
import * as THREE from 'three';
import { ISLANDS, REEF } from '../config.js';
import { buildIslandMesh, heightAt, recolorIsland } from './terrain.js';
import { makeScatters } from './props.js';
import { mulberry32, wrapAngle } from '../util.js';
import { bakeInto } from './bake.js';

const DENSITY = { tropical: 1, sand: 0.5, rock: 0.15, teFiti: 0.6, dark: 0.3, spire: 0.3, lava: 0 };

export function buildWorld(game) {
  const scene = game.scene;
  const scat = makeScatters(scene);
  game.scatters = scat;
  for (const isl of ISLANDS) scene.add(buildIslandMesh(isl));

  const exclude = game.excludeZones; // [{x,z,r}] 마을 등
  const isExcluded = (x, z) => exclude.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r);

  ISLANDS.forEach((isl, idx) => {
    const rnd = mulberry32(1000 + idx * 17);
    const R = isl.radius;
    const area = Math.PI * R * R;
    const dens = DENSITY[isl.type] ?? 0.5;
    const palmCount = Math.floor((area / 2600) * dens * (isl.id === 'motunui' ? 1.5 : 1));
    const slope = (x, z) => Math.hypot(heightAt(x + 1, z) - heightAt(x, z), heightAt(x, z + 1) - heightAt(x, z));
    const tryPoints = (n, fn) => {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 1.05;
        const x = isl.x + Math.sin(a) * d, z = isl.z + Math.cos(a) * d;
        if (isExcluded(x, z)) continue;
        fn(x, z, heightAt(x, z), rnd);
      }
    };
    if (isl.sunken) return; // 모투페투는 떠오를 때 식생을 만든다
    // 야자수
    tryPoints(palmCount * 3, (x, z, h) => {
      if (h < 1.1 || h > (isl.type === 'tropical' ? 45 : 20)) return;
      if (slope(x, z) > 0.6) return;
      const s = 0.8 + rnd() * 0.55, yaw = rnd() * Math.PI * 2;
      if (isl.blighted) {
        scat.deadPalms.add(x, h - 0.2, z, s, yaw);
        scat.restoredPalms.add(x, h - 0.2, z, s, yaw);
      } else if (isl.type !== 'lava') scat.palms.add(x, h - 0.2, z, s, yaw);
    });
    // 덤불 (정글)
    if (isl.type === 'tropical' || isl.type === 'teFiti' || isl.type === 'dark') {
      tryPoints(Math.floor(area / 900), (x, z, h) => {
        if (h < 5 || slope(x, z) > 1.2 || isl.blighted) return;
        const s = 1.0 + rnd() * 1.6;
        scat.bushes.add(x, h, z, s, rnd() * 6, s * (0.5 + rnd() * 0.4));
      });
      tryPoints(Math.floor(area / 900), (x, z, h) => {
        if (h < 1.8 || h > 20 || isl.blighted || isl.type === 'dark') return;
        scat.flowers.add(x, h + 0.2, z, 0.7 + rnd() * 0.6, rnd() * 6);
      });
    }
    // 바위
    const rockN = Math.floor(area / (isl.type === 'rock' || isl.type === 'spire' ? 350 : 1600));
    tryPoints(rockN, (x, z, h) => {
      if (h < -3) return;
      const s = 0.5 + rnd() * (isl.type === 'rock' ? 3 : 1.5);
      (isl.type === 'lava' ? scat.lavaRocks : scat.rocks).add(x, h, z, s, rnd() * 6, s * (0.5 + rnd() * 0.5));
    });
    if (isl.type === 'lava') {
      tryPoints(40, (x, z, h) => {
        if (h < 0) return;
        const s = 1 + rnd() * 3;
        scat.lavaRocks.add(x, h, z, s, rnd() * 6, s * (0.7 + rnd()));
      });
    }
  });

  // 모투누이 암초: 바위 고리 (남쪽은 열린 통로)
  const rnd = mulberry32(99);
  const foamGroup = new THREE.Group();
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  for (let a = 0; a < Math.PI * 2; a += 0.018) {
    if (Math.abs(wrapAngle(a - REEF.gapAngle)) < REEF.gapWidth) continue;
    const r = REEF.r + (rnd() - 0.5) * 14;
    const x = REEF.x + Math.sin(a) * r, z = REEF.z + Math.cos(a) * r;
    const s = 1.2 + rnd() * 2.2;
    scat.rocks.add(x, -1.2 + rnd() * 1.2, z, s, rnd() * 6, s * 0.8);
    if (rnd() < 0.5) {
      const f = new THREE.Mesh(new THREE.CircleGeometry(3 + rnd() * 3, 7), foamMat);
      f.rotation.x = -Math.PI / 2;
      f.position.set(x, 0.35, z);
      f.userData.phase = rnd() * 6;
      foamGroup.add(f);
    }
  }
  scene.add(foamGroup);
  bakeInto(foamGroup);
  game.reefFoam = foamGroup;

  for (const s of Object.values(scat)) s.finish();
  scat.restoredPalms.mesh.visible = false;
}

// 테 피티 복원: 시든 섬들이 다시 초록빛으로
export function restoreBlight(game) {
  for (const isl of ISLANDS) {
    if (isl.blighted && !isl.restored) {
      isl.restored = true;
      recolorIsland(isl);
    }
  }
  game.scatters.deadPalms.mesh.visible = false;
  game.scatters.restoredPalms.mesh.visible = true;
}

export function updateReefFoam(game, t) {
  const f = game.reefFoam && game.reefFoam.children[0];
  if (f) f.material.opacity = 0.45 + Math.sin(t * 1.4) * 0.2;
}
