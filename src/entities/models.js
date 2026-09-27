// 캐릭터 모델 (로우폴리 도형 조합) + 절차적 애니메이션
import * as THREE from 'three';
import { tattooTexture, skirtTexture, heartTexture } from '../textures.js';
import { bakeHierarchy } from '../world/bake.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...opts }));
  return matCache.get(key);
}
const geo = {
  sphere: new THREE.IcosahedronGeometry(1, 1),
  sphereSmooth: new THREE.SphereGeometry(1, 14, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
};
export function part(g, material, sx, sy, sz, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo[g] || g, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
// 아래로 뻗은 팔/다리 (피벗이 위쪽 끝)
function limb(material, radius, length, x, y, z, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = part('cyl', material, radius, length, radius, 0, -length / 2, 0, pivot);
  m.userData.limb = true;
  parent.add(pivot);
  return pivot;
}

function eyes(head, r, color = '#1a1410', spread = 0.38, y = 0.1) {
  part('sphereSmooth', mat('#ffffff'), r * 0.2, r * 0.24, r * 0.1, -r * spread, r * y, r * 0.9, head);
  part('sphereSmooth', mat('#ffffff'), r * 0.2, r * 0.24, r * 0.1, r * spread, r * y, r * 0.9, head);
  part('sphereSmooth', mat(color), r * 0.12, r * 0.15, r * 0.08, -r * spread, r * y, r * 0.97, head);
  part('sphereSmooth', mat(color), r * 0.12, r * 0.15, r * 0.08, r * spread, r * y, r * 0.97, head);
}

function hairCloud(head, r, color, count, spreadDown, seed = 1, width = 1) {
  const m = mat(color);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  part('sphere', m, r * 1.08, r * 1.05, r * 1.08, 0, r * 0.12, -r * 0.08, head);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const a = (rnd() - 0.5) * Math.PI * 1.2;
    const y = r * 0.5 - t * spreadDown;
    const rr = r * (0.55 + rnd() * 0.35) * width;
    part('sphere', m, rr, rr * 1.1, rr, Math.sin(a) * r * 0.85 * width, y, -r * 0.55 - Math.cos(a) * r * 0.3 - t * r * 0.3, head);
  }
}

// 사람 모양 기본 몸
export function humanoid(o) {
  const H = o.height || 1.6;
  const W = o.width || 1;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = o.skinMat || mat(o.skin || '#8d5a3b');
  const hipY = H * 0.46, shY = H * 0.8;
  const torsoR = H * 0.11 * W;
  const parts = { root, body };
  parts.legL = limb(skin, H * 0.045 * W, hipY, -H * 0.065 * W, hipY, 0, body);
  parts.legR = limb(skin, H * 0.045 * W, hipY, H * 0.065 * W, hipY, 0, body);
  const torsoMat = o.torsoMat || skin;
  parts.torso = part('cyl', torsoMat, torsoR, shY - hipY + H * 0.04, torsoR * 0.78, 0, (hipY + shY) / 2, 0, body);
  // 가슴/어깨 볼륨
  part('sphere', torsoMat, torsoR * 1.05, H * 0.07, torsoR * 0.8, 0, shY - H * 0.02, 0, body);
  if (o.top) part('cyl', mat(o.top), torsoR * 1.08, H * 0.1, torsoR * 0.88, 0, shY - H * 0.08, 0, body);
  if (o.skirt || o.skirtMat) {
    const sk = part('cyl', o.skirtMat || mat(o.skirt), 1, 1, 1, 0, hipY - H * 0.08, 0, body);
    sk.geometry = new THREE.CylinderGeometry(torsoR * 1.05, torsoR * 1.7, H * 0.28, 12, 1, true);
    sk.scale.set(1, 1, 0.9);
    sk.material = (o.skirtMat || mat(o.skirt)).clone();
    sk.material.side = THREE.DoubleSide;
    parts.skirt = sk;
  }
  parts.armL = limb(skin, H * 0.035 * W, H * 0.36, -(torsoR + H * 0.035 * W), shY, 0, body);
  parts.armR = limb(skin, H * 0.035 * W, H * 0.36, torsoR + H * 0.035 * W, shY, 0, body);
  parts.armL.rotation.z = -0.12; parts.armR.rotation.z = 0.12;
  const head = new THREE.Group();
  head.position.set(0, shY + H * 0.11, 0);
  body.add(head);
  const hr = H * 0.1;
  part('sphere', skin, hr * 0.95, hr, hr * 0.95, 0, 0, 0, head);
  part('sphere', skin, hr * 0.18, hr * 0.2, hr * 0.15, 0, -hr * 0.1, hr * 0.95, head); // 코
  eyes(head, hr);
  parts.head = head;
  parts.headR = hr;
  parts.H = H;
  parts.shY = shY;
  root.userData.parts = parts;
  return parts;
}

export function buildMoana() {
  const p = humanoid({ height: 1.6, skin: '#8d5a3b', top: '#b8412e', skirtMat: new THREE.MeshStandardMaterial({ map: skirtTexture(), flatShading: true, roughness: 0.9 }) });
  hairCloud(p.head, p.headR, '#16110e', 14, p.H * 0.35, 3, 1.05);
  // 목걸이 + 로켓(심장이 들어있음)
  const neck = new THREE.Mesh(new THREE.TorusGeometry(p.H * 0.075, 0.008, 6, 20), mat('#3b2a1c'));
  neck.rotation.x = Math.PI / 2 - 0.35;
  neck.position.set(0, p.shY + 0.01, 0.03);
  p.body.add(neck);
  const locket = part('sphere', mat('#2c7f8a', { metalness: 0.4, roughness: 0.3 }), 0.035, 0.045, 0.02, 0, p.shY - 0.07, p.H * 0.11 * 0.8 + 0.01, p.body);
  p.locket = locket;
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 1), new THREE.MeshStandardMaterial({ map: heartTexture(), emissive: '#2fd39a', emissiveIntensity: 0.9 }));
  heart.position.set(0, p.shY - 0.07, p.H * 0.11 * 0.8 + 0.035);
  heart.visible = false;
  heart.userData.keep = true;
  p.body.add(heart);
  p.heart = heart;
  // 노 (공격용, 평소엔 숨김)
  const oar = new THREE.Group();
  part('cyl', mat('#7a4a28'), 0.025, 1.3, 0.025, 0, -0.4, 0, oar);
  part('box', mat('#7a4a28'), 0.14, 0.4, 0.03, 0, -1.1, 0, oar);
  oar.position.set(0, -p.H * 0.34, 0);
  oar.visible = false;
  p.armR.add(oar);
  p.oar = oar;
  p.root.name = 'moana';
  bakeHierarchy(p.root);
  return p;
}

// 마우이의 마법 갈고리
export function buildHook(scale = 1) {
  const g = new THREE.Group();
  // 긴 손잡이 + 위쪽에서 아래로 말린 갈고리
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(0, (i / 8) * 1.6, 0));
  for (let i = 1; i <= 16; i++) {
    const a = Math.PI - (i / 16) * (Math.PI + 0.3);
    pts.push(new THREE.Vector3(0.45 + Math.cos(a) * 0.45, 1.6 + Math.sin(a) * 0.45, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.07, 8), mat('#e8dcc0', { roughness: 0.5 }));
  tube.castShadow = true;
  g.add(tube);
  // 끝의 미늘
  const tip = part('cone', mat('#e8dcc0'), 0.09, 0.3, 0.09, 0.88, 1.4, 0, g);
  tip.rotation.z = Math.PI;
  // 손잡이 감은 끈
  part('cyl', mat('#5a3a1e'), 0.085, 0.5, 0.085, 0, 0.25, 0, g);
  // 빛나는 새김 무늬
  const glow = part('cyl', mat('#7cf5ff', { emissive: '#3ad7ff', emissiveIntensity: 0.6 }), 0.075, 0.08, 0.075, 0, 0.9, 0, g);
  glow.userData.keep = true;
  g.userData.glow = glow;
  g.scale.setScalar(scale);
  return g;
}

export function buildMaui() {
  const skinMat = new THREE.MeshStandardMaterial({ color: '#b07048', flatShading: true, roughness: 0.8 });
  const tatMat = new THREE.MeshStandardMaterial({ map: tattooTexture('#9a6035'), flatShading: true, roughness: 0.8 });
  const p = humanoid({ height: 2.5, width: 1.75, skinMat, torsoMat: tatMat, skirt: '#3f7a2c' });
  // 팔에도 문신
  p.armL.children[0].material = tatMat;
  p.armR.children[0].material = tatMat;
  hairCloud(p.head, p.headR, '#140f0c', 22, p.H * 0.3, 9, 1.35);
  // 이빨 목걸이
  for (let i = -4; i <= 4; i++) {
    const a = i * 0.28;
    const t = part('cone', mat('#f2ead6'), 0.035, 0.12, 0.035, Math.sin(a) * 0.3, p.shY - 0.06 - Math.cos(a) * 0.04, Math.cos(a) * 0.26, p.body);
    t.rotation.x = Math.PI;
  }
  // 나뭇잎 치마 조각
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const leaf = part('box', mat(i % 2 ? '#4f8f33' : '#3a7026'), 0.14, 0.5, 0.03, Math.sin(a) * 0.5, p.H * 0.36, Math.cos(a) * 0.42, p.body);
    leaf.rotation.y = a;
  }
  const hook = buildHook(1);
  hook.position.set(0, -p.H * 0.34, 0.05);
  hook.rotation.x = -0.3;
  p.armR.add(hook);
  p.hook = hook;
  hook.visible = false;
  // 매(새) 변신 모습
  const hawk = new THREE.Group();
  const brown = mat('#6b4428'), light = mat('#e9dcc4');
  part('sphere', brown, 0.35, 0.3, 0.7, 0, 0, 0, hawk);
  part('sphere', light, 0.28, 0.28, 0.3, 0, 0.12, 0.62, hawk);
  const beak = part('cone', mat('#e8b73a'), 0.08, 0.22, 0.08, 0, 0.08, 0.95, hawk);
  beak.rotation.x = Math.PI / 2;
  part('sphereSmooth', mat('#111'), 0.05, 0.05, 0.05, -0.15, 0.2, 0.82, hawk);
  part('sphereSmooth', mat('#111'), 0.05, 0.05, 0.05, 0.15, 0.2, 0.82, hawk);
  const tail = part('box', brown, 0.4, 0.05, 0.5, 0, 0, -0.8, hawk);
  tail.rotation.x = 0.1;
  const wingL = new THREE.Group(), wingR = new THREE.Group();
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, 0, 0, -0.35, 1.9, 0, -0.5, 0, 0, 0.35, 1.9, 0, -0.5, 1.6, 0, 0.1], 3));
  wgeo.computeVertexNormals();
  const wmat = new THREE.MeshStandardMaterial({ color: '#5a3820', side: THREE.DoubleSide, flatShading: true });
  const wl = new THREE.Mesh(wgeo, wmat); wl.castShadow = true;
  const wr = new THREE.Mesh(wgeo, wmat); wr.castShadow = true; wr.scale.x = -1;
  wingL.add(wr); wingR.add(wl);
  wingL.position.x = -0.25; wingR.position.x = 0.25;
  hawk.add(wingL, wingR);
  hawk.position.y = 1.0;
  hawk.scale.setScalar(1.3);
  hawk.visible = false;
  p.root.add(hawk);
  p.hawk = hawk;
  p.wingL = wingL; p.wingR = wingR;
  p.root.name = 'maui';
  bakeHierarchy(p.root);
  return p;
}

export function buildHeihei() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const cream = mat('#efe3c2'), red = mat('#d8342a'), yellow = mat('#f0b429'), teal = mat('#1f4f55');
  part('sphere', cream, 0.2, 0.22, 0.26, 0, 0.36, 0, body);
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.14);
  body.add(head);
  part('cyl', cream, 0.07, 0.2, 0.07, 0, -0.1, -0.02, head);
  part('sphere', cream, 0.11, 0.12, 0.11, 0, 0, 0, head);
  for (let i = -1; i <= 1; i++) part('sphere', red, 0.035, 0.05, 0.04, 0, 0.12 + (1 - Math.abs(i)) * 0.02, i * 0.04, head);
  const beak = part('cone', yellow, 0.035, 0.1, 0.035, 0, -0.01, 0.13, head);
  beak.rotation.x = Math.PI / 2;
  part('sphere', red, 0.025, 0.05, 0.025, 0, -0.07, 0.09, head);
  // 헤이헤이의 멍한 눈 (짝짝이)
  part('sphereSmooth', mat('#ffffff'), 0.045, 0.045, 0.03, -0.06, 0.03, 0.08, head);
  part('sphereSmooth', mat('#ffffff'), 0.045, 0.045, 0.03, 0.06, 0.03, 0.08, head);
  part('sphereSmooth', mat('#111'), 0.02, 0.02, 0.02, -0.075, 0.05, 0.1, head);
  part('sphereSmooth', mat('#111'), 0.02, 0.02, 0.02, 0.05, 0.01, 0.105, head);
  for (let i = 0; i < 4; i++) {
    const t = part('cone', teal, 0.05, 0.3, 0.03, (i - 1.5) * 0.05, 0.5, -0.26, body);
    t.rotation.x = -0.6 - i * 0.1;
  }
  const legL = limb(yellow, 0.015, 0.2, -0.07, 0.2, 0, body);
  const legR = limb(yellow, 0.015, 0.2, 0.07, 0.2, 0, body);
  part('box', yellow, 0.07, 0.01, 0.08, 0, -0.2, 0.03, legL);
  part('box', yellow, 0.07, 0.01, 0.08, 0, -0.2, 0.03, legR);
  const parts = { root, body, head, legL, legR, H: 0.7 };
  root.userData.parts = parts;
  root.name = 'heihei';
  bakeHierarchy(root);
  return parts;
}

export function buildPua() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pink = mat('#f4d6d0'), spot = mat('#5a4038'), snout = mat('#f0a8a8');
  part('sphere', pink, 0.26, 0.24, 0.34, 0, 0.34, 0, body);
  const spots = [[0.14, 0.44, -0.05], [-0.16, 0.38, 0.1], [0.05, 0.52, 0.15], [-0.08, 0.5, -0.18]];
  for (const [x, y, z] of spots) part('sphere', spot, 0.1, 0.08, 0.1, x, y, z, body);
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.32);
  body.add(head);
  part('sphere', pink, 0.18, 0.17, 0.17, 0, 0, 0, head);
  const sn = part('cyl', snout, 0.08, 0.08, 0.06, 0, -0.03, 0.17, head);
  sn.rotation.x = Math.PI / 2;
  part('sphereSmooth', mat('#8a4a4a'), 0.015, 0.02, 0.01, -0.03, -0.03, 0.21, head);
  part('sphereSmooth', mat('#8a4a4a'), 0.015, 0.02, 0.01, 0.03, -0.03, 0.21, head);
  part('sphereSmooth', mat('#111'), 0.03, 0.035, 0.02, -0.07, 0.05, 0.14, head);
  part('sphereSmooth', mat('#111'), 0.03, 0.035, 0.02, 0.07, 0.05, 0.14, head);
  const e1 = part('cone', spot, 0.06, 0.1, 0.03, -0.11, 0.15, 0.02, head); e1.rotation.z = 0.5;
  const e2 = part('cone', pink, 0.06, 0.1, 0.03, 0.11, 0.15, 0.02, head); e2.rotation.z = -0.5;
  const legs = [];
  for (const [x, z] of [[-0.13, 0.18], [0.13, 0.18], [-0.13, -0.18], [0.13, -0.18]]) legs.push(limb(pink, 0.05, 0.18, x, 0.18, z, body));
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10, Math.PI * 1.6), pink);
  tail.position.set(0, 0.42, -0.35);
  body.add(tail);
  const parts = { root, body, head, legs, H: 0.6 };
  root.userData.parts = parts;
  root.name = 'pua';
  bakeHierarchy(root);
  return parts;
}

const NPC_LOOKS = {
  tui: { height: 1.95, width: 1.45, skin: '#8a5634', top: '#6b2e1c', skirt: '#c9b48a', hair: '#1a1410', cape: true },
  sina: { height: 1.65, width: 1.05, skin: '#90603f', top: '#2f6b6b', skirt: '#dccba4', hair: '#1a1410' },
  tala: { height: 1.5, width: 1.05, skin: '#8d5a3b', top: '#e8e4d8', skirt: '#2f7f6a', hair: '#d9d6cf' },
  simea: { height: 1.0, width: 1.0, skin: '#8d5a3b', top: '#c75a3a', skirt: '#e9d7b0', hair: '#1a1410' },
  moni: { height: 1.75, width: 1.1, skin: '#8a5634', top: '#3f6ea8', skirt: '#d9c7a0', hair: '#1a1410' },
  loto: { height: 1.55, width: 1.05, skin: '#90603f', top: '#d8962a', skirt: '#6a4a2a', hair: '#2a1a10' },
  kele: { height: 1.7, width: 1.25, skin: '#7a4f33', top: '#5d6a3a', skirt: '#a88a5a', hair: '#9a948a' },
  villager: { height: 1.7, width: 1.1, skin: '#8a5634', top: '#9a4a2a', skirt: '#d9c7a0', hair: '#1a1410' },
};

export function buildNPC(kind, seed = 0) {
  const look = { ...(NPC_LOOKS[kind] || NPC_LOOKS.villager) };
  if (kind === 'villager') {
    const tops = ['#9a4a2a', '#3a6a8a', '#7a8a3a', '#b86a3a', '#5a3a6a', '#c7a03a'];
    const skins = ['#8a5634', '#9a6a44', '#7a4a2c', '#a57250'];
    look.top = tops[seed % tops.length];
    look.skin = skins[(seed >> 1) % skins.length];
    look.height = 1.55 + ((seed * 37) % 30) / 100;
    look.width = 1 + ((seed * 13) % 30) / 100;
  }
  const p = humanoid(look);
  hairCloud(p.head, p.headR, look.hair, kind === 'tala' ? 8 : 6, p.H * (kind === 'tala' || kind === 'sina' ? 0.25 : 0.08), seed + 5, 1);
  if (look.cape) {
    const cape = part('cone', mat('#e6d2a4'), p.H * 0.2, p.H * 0.3, p.H * 0.14, 0, p.shY - p.H * 0.1, -0.05, p.body);
    cape.rotation.x = 0.05;
    // 족장 머리장식
    for (let i = -2; i <= 2; i++) part('cone', mat('#f2ead6'), 0.03, 0.18, 0.03, i * 0.05, p.headR * 1.1, p.headR * 0.3, p.head);
  }
  if (kind === 'tala') {
    const shawl = part('cyl', mat('#e8e4d8'), p.H * 0.14, p.H * 0.1, p.H * 0.12, 0, p.shY - 0.02, 0, p.body);
    shawl.material = mat('#e8e4d8');
  }
  if (kind === 'loto') {
    // 로토의 도구 벨트
    part('box', mat('#5a3a1e'), 0.35, 0.06, 0.3, 0, p.H * 0.46, 0, p.body);
  }
  if (kind === 'moni') {
    // 마우이 팬 모니의 등 가방(두루마리)
    part('cyl', mat('#c9b48a'), 0.08, 0.5, 0.08, 0.12, p.shY - 0.2, -0.2, p.body).rotation.z = 0.6;
  }
  p.root.name = kind;
  bakeHierarchy(p.root);
  return p;
}

// 걷기/점프/오르기 등 애니메이션
export function animateHumanoid(p, a, dt) {
  const { state, speed = 0, t } = a;
  const s = Math.min(1, speed / 5);
  const ph = t * (6 + speed * 1.2);
  let legL = 0, legR = 0, armL = 0, armR = 0, armLz = -0.12, armRz = 0.12, bob = 0, lean = 0, headX = 0;
  if (state === 'climb') {
    const c = Math.sin(t * 8) * (a.climbMoving ? 1 : 0.15);
    armL = -2.6 + c * 0.4; armR = -2.6 - c * 0.4; legL = -0.4 - c * 0.5; legR = -0.4 + c * 0.5;
  } else if (state === 'air') {
    armL = -2.4; armR = -2.4; armLz = -0.5; armRz = 0.5; legL = -0.5; legR = 0.2;
  } else if (state === 'swim') {
    armL = Math.sin(t * 5) * 2; armR = -Math.sin(t * 5) * 2; legL = Math.sin(t * 8) * 0.4; legR = -legL; lean = 1.1;
  } else if (state === 'helm') {
    armL = -0.9; armR = -1.2; armLz = -0.3; armRz = 0.2; legL = 0.15; legR = -0.15; lean = 0.08;
  } else if (state === 'carry') {
    armL = -2.9; armR = -2.9; armLz = -0.25; armRz = 0.25;
    legL = Math.sin(ph) * 0.6 * s; legR = -legL;
  } else if (state === 'rescue') {
    armL = -2.8 + Math.sin(t * 3) * 0.2; armR = -2.8 - Math.sin(t * 3) * 0.2; armLz = -0.6; armRz = 0.6; legL = -0.3; legR = 0.3;
  } else if (state === 'dance') {
    armL = -1.6 + Math.sin(t * 2) * 0.6; armR = -1.6 - Math.sin(t * 2) * 0.6; armLz = -1.2; armRz = 1.2;
    bob = Math.abs(Math.sin(t * 2)) * 0.04; lean = Math.sin(t) * 0.1;
  } else if (state === 'sit') {
    legL = -1.5; legR = -1.5; bob = -p.H * 0.24; armL = -0.4; armR = -0.4;
  } else {
    const run = Math.min(1, Math.max(0, (speed - 6) / 3)); // 0=걷기, 1=달리기
    legL = Math.sin(ph) * (0.7 + 0.35 * run) * s;
    legR = -legL;
    armL = -Math.sin(ph) * (0.6 + 0.5 * run) * s - 0.5 * run;
    armR = Math.sin(ph) * (0.6 + 0.5 * run) * s - 0.5 * run;
    armLz = -0.12 - 0.15 * run; armRz = 0.12 + 0.15 * run;
    bob = Math.abs(Math.cos(ph)) * (0.05 + 0.04 * run) * s * p.H;
    lean = 0.08 * s + 0.22 * run;
    if (s < 0.05) {
      armL = Math.sin(t * 1.5) * 0.04; armR = -armL; headX = Math.sin(t * 0.7) * 0.05;
    }
  }
  if (a.swing > 0) {
    // 공격 휘두르기 (0..1)
    const k = a.swing; // 1 -> 0 으로 줄어듦: 들어올렸다가 내려치기
    armR = k > 0.6 ? -2.8 : 0.6 + (-2.8 - 0.6) * (k / 0.6);
    armRz = 0.2;
  }
  const L = 1 - Math.exp(-14 * dt);
  if (p.glb) {
    // 뼈대 없는 GLB: 몸 전체를 뒤뚱거리며 통통 튀게
    const moving = state === 'ground' || state === 'carry' ? s : 0;
    const run = Math.min(1, Math.max(0, (speed - 6) / 3));
    const wz = Math.sin(ph) * (0.07 + 0.05 * run) * moving;
    p.glb.rotation.z += (wz - p.glb.rotation.z) * L;
    p.glb.position.y = Math.abs(Math.sin(ph)) * (0.05 + 0.05 * run) * moving * p.H * 0.6;
    const climbWob = state === 'climb' ? Math.sin(t * 8) * 0.08 * (a.climbMoving ? 1 : 0.2) : 0;
    p.glb.rotation.y += (climbWob - p.glb.rotation.y) * L;
    if (state === 'dance') p.glb.rotation.y = Math.sin(t * 2) * 0.4;
    // 공격(노/갈고리): 몸 전체로 앞으로 내지르기
    const lunge = a.swing > 0 ? Math.sin((1 - a.swing) * Math.PI) * 0.45 : 0;
    p.glb.rotation.x += (lunge - p.glb.rotation.x) * Math.min(1, L * 2);
  }
  p.legL.rotation.x += (legL - p.legL.rotation.x) * L;
  p.legR.rotation.x += (legR - p.legR.rotation.x) * L;
  p.armL.rotation.x += (armL - p.armL.rotation.x) * L;
  p.armR.rotation.x += (armR - p.armR.rotation.x) * L;
  p.armL.rotation.z += (armLz - p.armL.rotation.z) * L;
  p.armR.rotation.z += (armRz - p.armR.rotation.z) * L;
  p.body.position.y += (bob - p.body.position.y) * L;
  p.body.rotation.x += (lean - p.body.rotation.x) * L;
  p.head.rotation.x += (headX - p.head.rotation.x) * L;
}

export function animateHawk(p, t, flapping) {
  const f = flapping ? Math.sin(t * 10) * 0.7 : Math.sin(t * 2) * 0.1 - 0.1;
  p.wingL.rotation.z = f;
  p.wingR.rotation.z = -f;
}

export function animateHeihei(p, a) {
  const { t, speed, state } = a;
  const ph = t * 14;
  const s = Math.min(1, speed / 2);
  p.legL.rotation.x = Math.sin(ph) * 0.8 * s;
  p.legR.rotation.x = -Math.sin(ph) * 0.8 * s;
  p.head.position.z = 0.14 + Math.sin(ph) * 0.04 * s;
  if (state === 'peck') p.head.rotation.x = Math.max(0, Math.sin(t * 9)) * 1.1;
  else if (state === 'carried' || state === 'rescue') { p.head.rotation.x = Math.sin(t * 20) * 0.3; p.legL.rotation.x = Math.sin(t * 25); p.legR.rotation.x = -Math.sin(t * 25); }
  else p.head.rotation.x = Math.sin(t * 3) * 0.15;
  p.body.rotation.z = state === 'wobble' ? Math.sin(t * 6) * 0.2 : 0;
  if (p.glb) {
    p.glb.rotation.z = Math.sin(ph) * 0.14 * s;
    p.glb.position.y = Math.abs(Math.sin(ph)) * 0.04 * s;
    p.glb.rotation.x = state === 'peck' ? Math.max(0, Math.sin(t * 9)) * 0.45 : state === 'carried' || state === 'rescue' ? Math.sin(t * 20) * 0.15 : 0;
  }
}

export function animatePua(p, a) {
  const { t, speed } = a;
  const s = Math.min(1, speed / 3);
  const ph = t * 12;
  p.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 * s; });
  p.body.position.y = Math.abs(Math.sin(ph)) * 0.05 * s;
  p.head.rotation.x = Math.sin(t * 2) * 0.1;
}
