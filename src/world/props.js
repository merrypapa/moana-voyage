// 소품: 야자수, 오두막(팔레), 바위, 덤불, 꽃
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { thatchTexture, woodTexture } from '../textures.js';
import { mat, part } from '../entities/models.js';

function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// 야자수 한 그루 지오메트리 (줄기 + 잎 + 코코넛)
export function palmGeometry({ dead = false, height = 9, coconuts = true } = {}) {
  const parts = [];
  const segs = 5;
  let x = 0, y = 0;
  const lean = 0.09;
  for (let i = 0; i < segs; i++) {
    const h = height / segs;
    const g = new THREE.CylinderGeometry(0.2 - i * 0.015, 0.26 - i * 0.015, h * 1.05, 5, 1, true);
    g.rotateZ(-lean * i * 0.5);
    g.translate(x, y + h / 2, 0);
    parts.push(colored(g, dead ? (i % 2 ? '#6d655c' : '#5d564f') : i % 2 ? '#8b6a45' : '#7a5b3a'));
    y += h;
    x += Math.sin(lean * i * 0.5) * h;
  }
  const top = new THREE.Vector3(x, y, 0);
  const leaves = dead ? 4 : 7;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + 0.3;
    // 잎: 휘어진 띠 모양
    const L = 4.2, W = 0.9, N = 4;
    const verts = [];
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      const w0 = W * Math.sin(Math.PI * Math.min(0.95, t0 + 0.08)), w1 = W * Math.sin(Math.PI * Math.min(0.95, t1 + 0.08));
      const d0 = -(t0 * t0) * (dead ? 3.8 : 2.2), d1 = -(t1 * t1) * (dead ? 3.8 : 2.2);
      const x0 = t0 * L, x1 = t1 * L;
      verts.push(x0, d0, -w0 / 2, x1, d1, -w1 / 2, x1, d1 + 0.15, w1 / 2 * 0);
      verts.push(x0, d0, w0 / 2, x0, d0 + 0.15, 0, x1, d1 + 0.15, 0);
      verts.push(x0, d0, w0 / 2, x1, d1 + 0.15, 0, x1, d1, w1 / 2);
      verts.push(x0, d0, -w0 / 2, x1, d1 + 0.15, 0, x0, d0 + 0.15, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    g.rotateY(a);
    g.translate(top.x, top.y, top.z);
    parts.push(colored(g, dead ? '#7a6f55' : i % 2 ? '#3f9a3a' : '#2f8a34'));
  }
  if (coconuts && !dead) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const g = new THREE.OctahedronGeometry(0.25, 0);
      g.translate(top.x + Math.cos(a) * 0.35, top.y - 0.35, Math.sin(a) * 0.35);
      parts.push(colored(g, '#6b4a1c'));
    }
  }
  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  merged.userData.top = top;
  return merged;
}

const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });

export class Scatter {
  // 인스턴스 메시 모음 (야자수, 덤불, 바위...)
  constructor(scene, geometry, material, max) {
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.max = max;
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }
  add(x, y, z, scale = 1, yaw = 0, sy = scale) {
    if (this.mesh.count >= this.max) return -1;
    const d = this.dummy;
    d.position.set(x, y, z);
    d.rotation.set(0, yaw, 0);
    d.scale.set(scale, sy, scale);
    d.updateMatrix();
    const i = this.mesh.count++;
    this.mesh.setMatrixAt(i, d.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    return i;
  }
  finish() {
    this.mesh.computeBoundingSphere();
  }
}

export function makeScatters(scene) {
  return {
    palms: new Scatter(scene, palmGeometry(), vcMat, 900),
    deadPalms: new Scatter(scene, palmGeometry({ dead: true }), vcMat, 400),
    restoredPalms: new Scatter(scene, palmGeometry(), vcMat, 400),
    bushes: new Scatter(scene, colored(new THREE.IcosahedronGeometry(1, 0), '#2f7a32'), vcMat, 2500),
    rocks: new Scatter(scene, colored(new THREE.DodecahedronGeometry(1, 0), '#6d665e'), vcMat, 1500),
    flowers: new Scatter(scene, colored(new THREE.OctahedronGeometry(0.35, 0), '#f07aa8'), vcMat, 1200),
    lavaRocks: new Scatter(scene, colored(new THREE.DodecahedronGeometry(1, 0), '#241c1a'), vcMat, 600),
  };
}

// 공유 재질 (같은 재질이어야 합쳐서 그릴 수 있음)
const shared = {};
const woodMat = () => shared.wood || (shared.wood = new THREE.MeshStandardMaterial({ map: woodTexture(), color: '#a07850', flatShading: true }));
const roofMat = () => {
  if (!shared.roof) {
    const t = thatchTexture().clone();
    t.repeat.set(3, 1);
    t.needsUpdate = true;
    shared.roof = new THREE.MeshStandardMaterial({ map: t, flatShading: true, roughness: 1 });
  }
  return shared.roof;
};
const stallRoofMat = () => shared.stallRoof || (shared.stallRoof = new THREE.MeshStandardMaterial({ map: thatchTexture(), flatShading: true }));

// 오두막 (팔레)
export function buildFale(scale = 1, big = false) {
  const g = new THREE.Group();
  const wood = woodMat();
  const R = big ? 6 : 3.6;
  part('cyl', mat('#8a7a64'), R + 0.4, 0.5, R + 0.4, 0, 0.25, 0, g);
  const posts = big ? 10 : 7;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    part('cyl', wood, 0.13, 2.6, 0.13, Math.cos(a) * R * 0.9, 1.8, Math.sin(a) * R * 0.9, g);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R * 1.35, big ? 5 : 3.4, 12, 1), roofMat());
  roof.position.y = 3.1 + (big ? 2.5 : 1.7);
  roof.castShadow = true;
  g.add(roof);
  // 바닥 돗자리
  part('cyl', mat('#d8c190'), R * 0.8, 0.05, R * 0.8, 0, 0.53, 0, g);
  if (big) part('cone', mat('#6b3a22'), 0.3, 0.8, 0.3, 0, 3.1 + 5.1, 0, g);
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// 음식 가판대
export function buildStall(foodColor, foodShape = 'sphere') {
  const g = new THREE.Group();
  const wood = woodMat();
  part('box', wood, 2.4, 0.15, 1.2, 0, 0.9, 0, g);
  for (const [x, z] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) part('cyl', wood, 0.06, 0.9, 0.06, x, 0.45, z, g);
  for (const [x, z] of [[-1.1, -0.5], [1.1, -0.5]]) part('cyl', wood, 0.06, 2.4, 0.06, x, 1.2, z, g);
  const roof = part('box', stallRoofMat(), 2.8, 0.12, 1.8, 0, 2.4, 0.1, g);
  roof.rotation.x = 0.2;
  // 바나나잎 깔개
  part('box', mat('#3a8a3a'), 2.2, 0.03, 1.0, 0, 0.99, 0, g);
  for (let i = 0; i < 7; i++) {
    const x = -0.9 + (i % 4) * 0.6, z = -0.2 + Math.floor(i / 4) * 0.4;
    if (foodShape === 'banana') {
      const b = part('cyl', mat(foodColor), 0.06, 0.4, 0.06, x, 1.08, z, g);
      b.rotation.z = Math.PI / 2 + 0.3;
    } else if (foodShape === 'fish') {
      part('sphere', mat(foodColor), 0.25, 0.08, 0.1, x, 1.06, z, g);
    } else {
      part('sphere', mat(foodColor), 0.15, 0.14, 0.15, x, 1.12, z, g);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// 작은 카누 (마을 해변/동굴)
export function buildSmallCanoe(color = '#8a5a32', sail = false) {
  const g = new THREE.Group();
  const hull = part('sphere', mat(color), 0.7, 0.45, 4, 0, 0.1, 0, g);
  hull.scale.set(0.7, 0.45, 4);
  part('box', mat('#5a3a20'), 0.9, 0.08, 6, 0, 0.45, 0, g);
  part('box', mat('#5a3a20'), 3, 0.08, 0.12, 1.3, 0.45, 1, g);
  part('box', mat('#5a3a20'), 3, 0.08, 0.12, 1.3, 0.45, -1, g);
  part('sphere', mat(color), 0.25, 0.2, 1.8, 2.7, 0.2, 0, g);
  if (sail) {
    part('cyl', mat('#5a3a20'), 0.06, 5, 0.06, 0, 2.8, 0.5, g);
    const s = part('cone', mat('#d9b77c'), 1.6, 4, 0.05, 0, 3, -0.4, g);
    s.rotation.x = 0.1;
  }
  return g;
}
