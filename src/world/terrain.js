// 섬 지형: 높이 함수, 메시 생성, 수심 텍스처
import * as THREE from 'three';
import { ISLANDS, WORLD, ZONES } from '../config.js';
import { clamp, smoothstep, fbm, lerp } from '../util.js';

const NOISE_AMP = { tropical: 7, sand: 1.2, rock: 5, lava: 6, teFiti: 3, dark: 7, spire: 3 };

// 섬별 가라앉은 정도 (모투페투는 처음에 바다 밑)
for (const isl of ISLANDS) {
  isl.sink = isl.sunken ? 70 : 0;
  isl.restored = !isl.blighted;
}

function blobHeight(b, d) {
  const t = 1 - d / b.r;
  if (t <= 0) return -Infinity;
  const u = clamp(t / b.flat, 0, 1);
  const shape = b.pow ? Math.pow(u, b.pow) : u * u * (3 - 2 * u);
  return -8 + (b.h + 8) * shape;
}

export function islandHeight(isl, x, z) {
  const lx = x - isl.x, lz = z - isl.z;
  const dc = Math.hypot(lx, lz);
  let h = lerp(WORLD.seaFloor, -9, smoothstep(isl.radius * 1.4, isl.radius * 0.7, dc));
  for (const b of isl.blobs) {
    const bh = blobHeight(b, Math.hypot(lx - b.x, lz - b.z));
    if (bh > h) h = bh;
  }
  const amp = NOISE_AMP[isl.type] || 3;
  const lo = isl.id === 'motunui' ? 4.6 : 1.5;
  const n = smoothstep(lo, lo + 10, h);
  if (n > 0) h += (fbm(x * 0.018, z * 0.018, 3) - 0.45) * amp * 2 * n;
  return h - isl.sink;
}

// 랄로타이(괴물의 세계) 지하 경기장
function lalotaiHeight(x, z) {
  const A = ZONES.lalotaiArena;
  const d = Math.hypot(x - A.x, z - A.z);
  if (d < A.r) return 0 + Math.max(0, (fbm(x * 0.05, z * 0.05) - 0.6)) * 3;
  return (d - A.r) * 2.2;
}

export function heightAt(x, z) {
  if (x > 7000) return lalotaiHeight(x, z);
  let h = WORLD.seaFloor;
  for (const isl of ISLANDS) {
    const R = isl.radius * 1.45;
    if (Math.abs(x - isl.x) > R || Math.abs(z - isl.z) > R) continue;
    const ih = islandHeight(isl, x, z);
    if (ih > h) h = ih;
  }
  return h;
}

// 어느 섬 근처인지
export function nearestIsland(x, z) {
  let best = null, bd = Infinity;
  for (const isl of ISLANDS) {
    if (isl.lavaRing) continue;
    const d = Math.hypot(x - isl.x, z - isl.z) - isl.radius;
    if (d < bd) { bd = d; best = isl; }
  }
  return { island: best, distance: bd };
}

// 가장 가까운 육지 지점 찾기 (바다가 모아나를 해변으로 데려다줄 때)
export function findShorePoint(x, z) {
  const { island } = nearestIsland(x, z);
  if (!island) return null;
  let dx = island.x - x, dz = island.z - z;
  const L = Math.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  for (let s = 0; s < L + 50; s += 2) {
    const px = x + dx * s, pz = z + dz * s;
    const h = heightAt(px, pz);
    if (h > 0.8) return { x: px + dx * 4, z: pz + dz * 4, y: heightAt(px + dx * 4, pz + dz * 4) };
  }
  return { x: island.x, z: island.z, y: heightAt(island.x, island.z) };
}

const C = (hex) => new THREE.Color(hex);
const PAL = {
  sandWet: C('#c7b27c'), sand: C('#efdca4'), grass: C('#4c9c3c'), grass2: C('#3a8a36'), jungle: C('#2d6e2e'),
  rock: C('#7d7263'), rockDark: C('#5a5048'), under: C('#bfae7e'), lava: C('#2b2320'), lavaHot: C('#5a2a18'),
  ash: C('#8a8580'), ashDark: C('#5d5956'), dark: C('#3f3a4a'), darkGrass: C('#4b5a45'), snowTop: C('#8f8a78'),
  flower: C('#e05a8a'),
};

function colorFor(isl, x, z, h, slope, out) {
  const n = fbm(x * 0.05, z * 0.05, 2);
  const blighted = isl.blighted && !isl.restored;
  let type = isl.type;
  if (type === 'lava' && isl.restored) type = 'tropical';
  if (h < -0.5) return out.copy(PAL.under).multiplyScalar(0.85 + n * 0.2);
  if (type === 'lava') {
    out.copy(PAL.lava).lerp(PAL.lavaHot, n * 0.8);
    return out;
  }
  if (h < 1.6) {
    out.copy(h < 0.4 ? PAL.sandWet : PAL.sand);
  } else if (type === 'sand') {
    out.copy(PAL.sand).lerp(PAL.grass, smoothstep(3, 8, h) * (n > 0.45 ? 1 : 0.2));
  } else if (type === 'rock' || type === 'spire') {
    out.copy(PAL.rock).lerp(PAL.rockDark, n);
    if (slope < 0.5 && h > 3) out.lerp(PAL.grass2, 0.6);
  } else if (type === 'dark') {
    out.copy(PAL.darkGrass).lerp(PAL.dark, smoothstep(10, 40, h) + n * 0.3);
  } else {
    out.copy(PAL.grass).lerp(PAL.grass2, n);
    out.lerp(PAL.jungle, smoothstep(15, 60, h));
    if (h < 3) out.lerp(PAL.sand, smoothstep(3, 1.6, h));
    if (slope > 0.9) out.lerp(PAL.rock, smoothstep(0.9, 1.6, slope));
    if (h > 85) out.lerp(PAL.snowTop, smoothstep(85, 105, h));
    if (type === 'teFiti' && isl.restored && n > 0.62) out.lerp(PAL.flower, 0.5);
  }
  if (blighted) {
    const g = out.r * 0.3 + out.g * 0.5 + out.b * 0.2;
    out.setRGB(g * 0.9, g * 0.88, g * 0.86).lerp(PAL.ashDark, 0.35);
  }
  return out;
}

const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });

export function buildIslandMesh(isl) {
  const size = isl.radius * 2.5;
  const step = isl.type === 'spire' ? 3.2 : isl.id === 'motunui' ? 5 : 4.5;
  const segs = Math.min(170, Math.ceil(size / step));
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  const e = 1.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + isl.x, z = pos.getZ(i) + isl.z;
    const h = islandHeight(isl, x, z) + isl.sink;
    pos.setY(i, h);
  }
  // 경사 계산 후 색 입히기
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + isl.x, z = pos.getZ(i) + isl.z;
    const h = pos.getY(i);
    const hx = islandHeight(isl, x + e, z) + isl.sink - h;
    const hz = islandHeight(isl, x, z + e) + isl.sink - h;
    const slope = Math.hypot(hx, hz) / e;
    colorFor(isl, x, z, h, slope, col);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainMaterial);
  mesh.position.set(isl.x, -isl.sink, isl.z);
  mesh.receiveShadow = true;
  mesh.userData.island = isl;
  isl.mesh = mesh;
  return mesh;
}

export function recolorIsland(isl) {
  const geo = isl.mesh.geometry;
  const pos = geo.attributes.position;
  const colors = geo.attributes.color;
  const col = new THREE.Color();
  const e = 1.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + isl.x, z = pos.getZ(i) + isl.z;
    const h = pos.getY(i);
    const hx = islandHeight(isl, x + e, z) + isl.sink - h;
    const hz = islandHeight(isl, x, z + e) + isl.sink - h;
    colorFor(isl, x, z, h, Math.hypot(hx, hz) / e, col);
    colors.setXYZ(i, col.r, col.g, col.b);
  }
  colors.needsUpdate = true;
}

// 월드 전체 수심 텍스처 (물 색/파도 거품용). R = (높이+40)/80
export const DEPTH_TEX_SIZE = 1024;
export function buildDepthTexture() {
  const N = DEPTH_TEX_SIZE;
  const data = new Uint8Array(N * N * 4);
  const half = WORLD.half;
  const cell = (half * 2) / N;
  const enc = (h) => clamp(Math.round(((h + 40) / 80) * 255), 0, 255);
  const deep = enc(WORLD.seaFloor);
  for (let i = 0; i < N * N; i++) { data[i * 4] = deep; data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const fillIsland = (isl) => {
    const R = isl.radius * 1.45;
    const x0 = Math.max(0, Math.floor((isl.x - R + half) / cell));
    const x1 = Math.min(N - 1, Math.ceil((isl.x + R + half) / cell));
    const z0 = Math.max(0, Math.floor((isl.z - R + half) / cell));
    const z1 = Math.min(N - 1, Math.ceil((isl.z + R + half) / cell));
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const x = -half + (i + 0.5) * cell, z = -half + (j + 0.5) * cell;
        data[(j * N + i) * 4] = enc(heightAt(x, z));
      }
    }
  };
  for (const isl of ISLANDS) fillIsland(isl);
  tex.needsUpdate = true;
  tex.userData.refresh = (isl) => { fillIsland(isl); tex.needsUpdate = true; };
  return tex;
}
