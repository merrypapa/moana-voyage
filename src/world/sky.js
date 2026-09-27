// 하늘: 그라데이션 돔, 해/달, 별, 구름, 낮과 밤
import * as THREE from 'three';
import { mulberry32, smoothstep, lerp } from '../util.js';

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFrag = `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNight;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.55));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.25) * (1.0 - uNight * 0.7);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const KEYS = [
  // 시간(0..1), 하늘 위, 수평선, 햇빛, 빛 세기
  [0.0, '#0a1330', '#1c2c55', '#8aa0ff', 0.28],
  [0.2, '#0f1f45', '#3a3f6e', '#9aa8ff', 0.3],
  [0.25, '#3c5ea8', '#ff9f6b', '#ffb07a', 0.6],
  [0.32, '#3d9be0', '#bfe6ff', '#fff0d0', 0.95],
  [0.5, '#2b8fe0', '#c8ecff', '#fff8e8', 1.0],
  [0.68, '#3d9be0', '#bfe6ff', '#fff0d0', 0.95],
  [0.75, '#4b4f9e', '#ff8a5c', '#ffa060', 0.6],
  [0.8, '#0f1f45', '#3a3f6e', '#9aa8ff', 0.3],
  [1.0, '#0a1330', '#1c2c55', '#8aa0ff', 0.28],
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uNight: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false })
    );
    dome.scale.setScalar(8000);
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.dome = dome;
    scene.add(dome);

    // 별
    const rnd = mulberry32(7);
    const starPos = [];
    for (let i = 0; i < 1400; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const r = Math.sqrt(1 - y * y);
      starPos.push(Math.cos(a) * r * 7000, y * 7000, Math.sin(a) * r * 7000);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // 달
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(90, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfdf6d8, fog: false }));
    scene.add(this.moon);

    // 구름 (모든 뭉게구름을 인스턴스 하나로)
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x556677, flatShading: true, transparent: true, opacity: 0.92, fog: false });
    const puffs = [];
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, d = 1500 + rnd() * 3500;
      const cx = Math.cos(a) * d, cy = 380 + rnd() * 300, cz = Math.sin(a) * d;
      const n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        puffs.push([cx + (k - n / 2) * 45 + rnd() * 20, cy + rnd() * 15, cz + rnd() * 30, 40 + rnd() * 50, 22 + rnd() * 18, 35 + rnd() * 30]);
      }
    }
    this.clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, puffs.length);
    const dm = new THREE.Object3D();
    puffs.forEach((p, i) => { dm.position.set(p[0], p[1], p[2]); dm.scale.set(p[3], p[4], p[5]); dm.updateMatrix(); this.clouds.setMatrixAt(i, dm.matrix); });
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    this.cloudMat = cloudMat;

    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfe6ff, 0x3a5a40, 1.1);
    scene.add(this.hemi);
    this.fogColor = new THREE.Color();
    this.light = 1;
    this.sunDir = new THREE.Vector3();
    this.override = null; // 랄로타이 같은 특별 지역용
  }

  update(timeOfDay, focus, fog, ocean, stormAmount = 0) {
    // 색 보간
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] < timeOfDay) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = (timeOfDay - a[0]) / (b[0] - a[0]);
    const top = this.uniforms.uTop.value.copy(tmpA.set(a[1])).lerp(tmpB.set(b[1]), t);
    const hor = this.uniforms.uHorizon.value.copy(tmpA.set(a[2])).lerp(tmpB.set(b[2]), t);
    const sunCol = this.uniforms.uSunColor.value.copy(tmpA.set(a[3])).lerp(tmpB.set(b[3]), t);
    let light = lerp(a[4], b[4], t);
    if (stormAmount > 0) {
      const grey = tmpA.set('#4a5560');
      top.lerp(grey, stormAmount * 0.8);
      hor.lerp(tmpB.set('#6a7580'), stormAmount * 0.8);
      light *= 1 - stormAmount * 0.45;
    }
    this.light = light;

    const ang = (timeOfDay - 0.25) * Math.PI * 2; // 0.25 해뜸, 0.75 해짐
    const sunUp = Math.sin(ang);
    const night = smoothstep(0.1, -0.15, sunUp);
    this.uniforms.uNight.value = night;
    // 밤에는 달빛 방향
    const dir = this.sunDir.set(Math.cos(ang) * 0.8, Math.max(Math.abs(sunUp), 0.25), 0.35).normalize();
    this.uniforms.uSunDir.value.set(Math.cos(ang), sunUp, 0.35).normalize();
    this.dome.position.copy(focus);
    this.stars.position.copy(focus);
    this.clouds.position.set(focus.x * 0.9, 0, focus.z * 0.9);
    this.starMat.opacity = night * (1 - stormAmount);
    this.moon.position.set(focus.x - Math.cos(ang) * 6000, focus.y - sunUp * 6000 + 200, focus.z - 2000);
    this.moon.visible = night > 0.05;
    this.cloudMat.emissive.setRGB(0.3 * light, 0.33 * light, 0.38 * light);
    this.cloudMat.color.setScalar(0.55 + 0.45 * light);

    this.sun.color.copy(sunCol);
    this.sun.intensity = 2.4 * light;
    this.sun.position.copy(focus).addScaledVector(dir, 150);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = 0.55 + 0.75 * light;
    this.hemi.color.copy(top).lerp(tmpA.set('#ffffff'), 0.4);

    this.fogColor.copy(hor).lerp(top, 0.2);
    fog.color.copy(this.fogColor);
    const far = stormAmount > 0 ? lerp(3200, 700, stormAmount) : 3200;
    fog.near = far * 0.18;
    fog.far = far;

    if (ocean) {
      const u = ocean.uniforms;
      u.uSunDir.value.copy(this.uniforms.uSunDir.value);
      if (sunUp < 0) u.uSunDir.value.copy(dir);
      u.uSunColor.value.copy(sunCol);
      u.uSkyColor.value.copy(hor).lerp(top, 0.4);
      u.uLight.value = light;
      u.uDeep.value.set('#0b4a86').lerp(tmpA.set('#274055'), stormAmount * 0.7);
    }
  }
}
