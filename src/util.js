// 공용 수학/노이즈 도구
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
// a에서 b로 최대 step만큼 각도를 이동
export const approachAngle = (a, b, step) => {
  const d = wrapAngle(b - a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
};
export const approach = (a, b, step) => (a < b ? Math.min(a + step, b) : Math.max(a - step, b));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// 시드 고정 난수
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// 값 노이즈 (0..1)
export function valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, z, oct = 3) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += valueNoise(x * f, z * f) * amp;
    n += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// 화면 좌표 방향을 한국어 방위로
export function bearingName(dx, dz) {
  // 지도 기준: -z = 북, +x = 동
  const a = Math.atan2(dx, -dz);
  const names = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return names[i];
}

// 한국어 조사: 받침이 있으면 a, 없으면 b (예: josa('모아나', '이', '가') → '모아나가')
export function josa(word, a, b) {
  const base = String(word).replace(/\s*\(.*\)\s*$/, '');
  const c = base.charCodeAt(base.length - 1);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return word + b;
  return word + ((c - 0xac00) % 28 ? a : b);
}
