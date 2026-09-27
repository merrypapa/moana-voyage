// 바다: 파도 셰이더 + JS 파도 높이 함수 (배 흔들림에 사용)
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { smoothstep } from '../util.js';

// 셰이더와 똑같은 파도 (dir.x, dir.z, 파수 k, 속도 w, 진폭 a)
const WAVES = [
  [0.8, 0.6, 0.06, 0.9, 0.34],
  [-0.5, 0.86, 0.11, 1.3, 0.22],
  [0.95, -0.3, 0.21, 1.9, 0.12],
  [-0.2, -0.98, 0.37, 2.6, 0.06],
];

export const storm = { x: 0, z: 0, r: 1, amount: 0 };

export function waveAmp(x, z) {
  if (storm.amount <= 0) return 1;
  const d = Math.hypot(x - storm.x, z - storm.z);
  return 1 + 2.4 * storm.amount * smoothstep(storm.r, storm.r * 0.35, d);
}

export function waveHeight(x, z, t) {
  let h = 0;
  for (const [dx, dz, k, w, a] of WAVES) h += a * Math.sin((x * dx + z * dz) * k + t * w);
  return h * waveAmp(x, z);
}

const vert = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec4 uStorm;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

float amp(vec2 p) {
  if (uStorm.w <= 0.0) return 1.0;
  float d = distance(p, uStorm.xy);
  return 1.0 + 2.4 * uStorm.w * smoothstep(uStorm.z, uStorm.z * 0.35, d);
}
${WAVES.map((w, i) => `const vec4 W${i} = vec4(${w[0].toFixed(3)}, ${w[1].toFixed(3)}, ${w[2].toFixed(3)}, ${w[3].toFixed(3)}); const float A${i} = ${w[4].toFixed(3)};`).join('\n')}
float waveH(vec2 p, out vec2 grad) {
  float h = 0.0; grad = vec2(0.0);
  ${WAVES.map((_, i) => `{ float ph = dot(p, W${i}.xy) * W${i}.z + uTime * W${i}.w; h += A${i} * sin(ph); grad += A${i} * cos(ph) * W${i}.z * W${i}.xy; }`).join('\n  ')}
  float a = amp(p);
  grad *= a;
  return h * a;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 g;
  float h = waveH(wp.xz, g);
  wp.y += h;
  vCrest = h;
  vWorld = wp.xyz;
  vNormal = normalize(vec3(-g.x, 1.0, -g.y));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform sampler2D uDepth;
uniform float uHalf;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uLight;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 uv = (vWorld.xz + uHalf) / (2.0 * uHalf);
  float terrain = texture2D(uDepth, uv).r * 80.0 - 40.0;
  float depth = max(0.0, -terrain);
  // 작은 물결 노멀
  vec2 q = vWorld.xz * 0.35 + vec2(uTime * 0.6, uTime * 0.4);
  vec3 n = normalize(vNormal + vec3(noise(q) - 0.5, 0.0, noise(q + 7.3) - 0.5) * 0.25);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  float shallow = smoothstep(22.0, 1.5, depth);
  vec3 water = mix(uDeep, uShallow, shallow);
  water = mix(water, uSkyColor, fres * 0.55);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(n, H), 0.0), 180.0) * 1.6;
  vec3 col = water * (0.35 + 0.65 * uLight) + uSunColor * spec * uLight;
  // 해안 거품
  float foamN = noise(vWorld.xz * 0.4 + uTime * 0.3);
  float shore = smoothstep(2.4, 0.2, depth + (foamN - 0.5) * 1.2 + sin(uTime * 1.5 + depth * 2.0) * 0.3);
  float crest = smoothstep(0.55, 0.9, vCrest) * foamN;
  col = mix(col, vec3(0.95, 0.98, 1.0) * (0.4 + 0.6 * uLight), clamp(shore * 0.85 + crest * 0.5, 0.0, 1.0));
  float dist = length(cameraPosition - vWorld);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
  #include <colorspace_fragment>
}
`;

function radialGeometry() {
  // 가운데는 촘촘하고 멀리는 성긴 원형 격자 (수평선까지)
  const rings = [];
  let r = 0;
  let step = 2.2;
  while (r < 9000) {
    rings.push(r);
    r += step;
    step *= r < 400 ? 1.018 : 1.07;
  }
  const segs = 180;
  const verts = [];
  const idx = [];
  for (let i = 0; i < rings.length; i++) {
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      verts.push(Math.cos(a) * rings[i], 0, Math.sin(a) * rings[i]);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < segs; s++) {
      const a = i * segs + s, b = i * segs + ((s + 1) % segs);
      const c = (i + 1) * segs + s, d = (i + 1) * segs + ((s + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return geo;
}

export class Ocean {
  constructor(depthTex) {
    this.uniforms = {
      uTime: { value: 0 },
      uStorm: { value: new THREE.Vector4(0, 0, 1, 0) },
      uDepth: { value: depthTex },
      uHalf: { value: WORLD.half },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() },
      uSunColor: { value: new THREE.Color('#fff4d6') },
      uSkyColor: { value: new THREE.Color('#8fd3ff') },
      uDeep: { value: new THREE.Color('#0b4a86') },
      uShallow: { value: new THREE.Color('#2fe0d0') },
      uFogColor: { value: new THREE.Color('#bfe6ff') },
      uFogNear: { value: 400 },
      uFogFar: { value: 3000 },
      uLight: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag });
    this.mesh = new THREE.Mesh(radialGeometry(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }
  update(t, camera, fog) {
    this.uniforms.uTime.value = t;
    this.mesh.position.set(camera.position.x, WORLD.waterLevel, camera.position.z);
    this.uniforms.uStorm.value.set(storm.x, storm.z, storm.r, storm.amount);
    if (fog) {
      this.uniforms.uFogColor.value.copy(fog.color);
      this.uniforms.uFogNear.value = fog.near;
      this.uniforms.uFogFar.value = fog.far;
    }
  }
}
