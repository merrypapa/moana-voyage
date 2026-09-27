// 드로우콜 줄이기: 같은 재질의 정적인 메시들을 하나로 합친다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function normalize(geo, m, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  const needUV = !!(m.map || m.emissiveMap);
  for (const name of Object.keys(g.attributes)) {
    if (name === 'position' || name === 'normal') continue;
    if (name === 'uv' && needUV) continue;
    if (name === 'color' && m.vertexColors) continue;
    g.deleteAttribute(name);
  }
  if (needUV && !g.attributes.uv) return null;
  if (m.vertexColors && !g.attributes.color) return null;
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  g.clearGroups();
  g.applyMatrix4(matrix);
  return g;
}

function isDynamic(o, stop) {
  for (let p = o; p && p !== stop; p = p.parent) if (p.userData && (p.userData.dynamic || p.userData.keep)) return true;
  return false;
}

function flush(buckets, target) {
  const made = [];
  for (const b of buckets.values()) {
    if (b.list.length < 2 && !b.force) continue;
    const merged = mergeGeometries(b.list);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.m);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    target.add(mesh);
    for (const o of b.src) o.parent && o.parent.remove(o);
    made.push(mesh);
  }
  return made;
}

// root 아래 모든 정적 메시를 root 좌표계로 합친다 (움직이지 않는 소품 묶음용)
export function bakeInto(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const mtx = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o === root || !o.visible || isDynamic(o, root)) return;
    const m = o.material;
    if (Array.isArray(m)) return;
    mtx.multiplyMatrices(inv, o.matrixWorld);
    const g = normalize(o.geometry, m, mtx);
    if (!g) return;
    const key = `${m.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { m, list: [], src: [], cast: o.castShadow, recv: o.receiveShadow });
    const b = buckets.get(key);
    b.list.push(g);
    b.src.push(o);
  });
  for (const b of buckets.values()) b.force = b.list.length >= 2;
  return flush(buckets, root);
}

// 캐릭터처럼 관절(그룹)이 움직이는 모델: 그룹마다 바로 아래 메시들만 합친다
export function bakeHierarchy(root) {
  const groups = [];
  root.traverse((o) => { if (!o.isMesh && o.children.length) groups.push(o); });
  for (const grp of groups) {
    if (grp.userData.keep) continue;
    const buckets = new Map();
    for (const o of grp.children) {
      if (!o.isMesh || o.isInstancedMesh || o.children.length || o.userData.keep || !o.visible) continue;
      const m = o.material;
      if (Array.isArray(m)) continue;
      o.updateMatrix();
      const g = normalize(o.geometry, m, o.matrix);
      if (!g) continue;
      const key = `${m.uuid}|${o.castShadow}|${o.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, { m, list: [], src: [], cast: o.castShadow, recv: o.receiveShadow });
      const b = buckets.get(key);
      b.list.push(g);
      b.src.push(o);
    }
    flush(buckets, grp);
  }
}
