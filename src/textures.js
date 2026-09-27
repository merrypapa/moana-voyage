// 캔버스로 직접 그리는 텍스처들
import * as THREE from 'three';

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function spiral(g, cx, cy, turns, maxR, width, color) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = t * maxR;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
}

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

// 엮은 판다누스 돛 + 나선 무늬
export const sailTexture = () => once('sail', () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d9b77c';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16 + y / 16) % 2 ? 'rgba(120,80,40,0.18)' : 'rgba(255,240,200,0.15)';
      g.fillRect(x, y, 16, 16);
    }
  }
  g.strokeStyle = 'rgba(90,60,30,0.35)';
  g.lineWidth = 2;
  for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  spiral(g, w * 0.5, h * 0.52, 3.2, 150, 20, '#8a3a22');
  g.fillStyle = '#8a3a22';
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    const x = 40 + i * 38;
    g.moveTo(x, h - 20); g.lineTo(x + 16, h - 50); g.lineTo(x + 32, h - 20); g.fill();
  }
}));

// 마우이 문신 (몸통/팔)
export const tattooTexture = (skin = '#9a6035') => once('tattoo' + skin, () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = skin;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1d1410';
  g.fillStyle = '#1d1410';
  g.lineWidth = 7;
  // 가로 띠 무늬
  for (const y of [60, 180, 330, 450]) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    for (let x = 0; x < w; x += 28) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + 20); g.lineTo(x + 28, y); g.fill();
    }
  }
  // 나선과 물고기, 태양 문양
  spiral(g, 130, 260, 2.5, 50, 7, '#1d1410');
  spiral(g, 390, 260, 2.5, 50, 7, '#1d1410');
  g.beginPath(); g.arc(256, 110, 28, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(256 + Math.cos(a) * 34, 110 + Math.sin(a) * 34); g.lineTo(256 + Math.cos(a) * 52, 110 + Math.sin(a) * 52); g.stroke();
  }
  // 물고기
  g.beginPath(); g.ellipse(256, 395, 60, 22, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(316, 395); g.lineTo(346, 375); g.lineTo(346, 415); g.closePath(); g.fill();
}));

// 모아나 치마 무늬
export const skirtTexture = () => once('skirt', () => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#e9d7b0';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#b24b2e';
  g.fillRect(0, 0, w, 16);
  g.fillStyle = '#6b3a22';
  for (let x = 0; x < w; x += 24) {
    g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 12, 58); g.lineTo(x + 24, 40); g.fill();
    g.beginPath(); g.moveTo(x, 90); g.lineTo(x + 12, 72); g.lineTo(x + 24, 90); g.fill();
  }
  g.fillStyle = '#b24b2e';
  g.fillRect(0, h - 14, w, 14);
}, true));

// 테 피티의 심장 (초록 돌 + 나선)
export const heartTexture = () => once('heart', () => canvasTex(128, 128, (g, w, h) => {
  const grd = g.createRadialGradient(54, 50, 6, 64, 64, 64);
  grd.addColorStop(0, '#c8ffe6'); grd.addColorStop(0.5, '#2fd39a'); grd.addColorStop(1, '#0b5a40');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  spiral(g, 64, 64, 3, 46, 7, '#b6ffe0');
}));

// 테 카 용암 균열 (emissive 맵)
export const lavaCrackTexture = () => once('lava', () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ff6a1a';
  g.lineWidth = 5;
  g.shadowColor = '#ffb040'; g.shadowBlur = 12;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 80; y += (Math.random() - 0.5) * 80; g.lineTo(x, y); }
    g.stroke();
  }
}, true));

// 카카모라 코코넛 얼굴 (하얀 물감)
export const kakamoraFaceTexture = (variant = 0) => once('kaka' + variant, () => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#6b4526'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 2;
  for (let i = 0; i < 60; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + 8, y + 3); g.stroke(); }
  // 얼굴은 u=0.75 근처 (앞쪽)
  const cx = w * 0.75, cy = h * 0.5;
  g.fillStyle = '#f4f0e6'; g.strokeStyle = '#f4f0e6'; g.lineWidth = 5;
  const eyes = [[-20, -12], [20, -12]];
  for (const [ex, ey] of eyes) {
    g.beginPath();
    if (variant % 3 === 0) g.arc(cx + ex, cy + ey, 9, 0, Math.PI * 2);
    else if (variant % 3 === 1) { g.moveTo(cx + ex - 10, cy + ey - 8); g.lineTo(cx + ex + 10, cy + ey + 8); g.moveTo(cx + ex + 10, cy + ey - 8); g.lineTo(cx + ex - 10, cy + ey + 8); }
    else g.rect(cx + ex - 8, cy + ey - 8, 16, 16);
    variant % 3 === 1 ? g.stroke() : g.fill();
  }
  g.beginPath();
  if (variant % 2) { g.moveTo(cx - 24, cy + 16); for (let i = 0; i <= 6; i++) g.lineTo(cx - 24 + i * 8, cy + 16 + (i % 2 ? 8 : 0)); g.stroke(); }
  else { g.arc(cx, cy + 12, 18, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
  g.fillStyle = '#f4f0e6';
  for (let i = -2; i <= 2; i++) g.fillRect(cx + i * 22 - 2, cy - 40, 4, 12);
}));

// 초가 지붕
export const thatchTexture = () => once('thatch', () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b8914f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    g.strokeStyle = Math.random() > 0.5 ? 'rgba(90,60,25,0.45)' : 'rgba(240,210,140,0.4)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y + 18); g.stroke();
  }
  for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(80,50,20,0.35)'; g.fillRect(0, y, w, 4); }
}, true));

// 나무 결
export const woodTexture = () => once('wood', () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#8a5a32'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 3) {
    g.strokeStyle = `rgba(${60 + Math.random() * 40},${35 + Math.random() * 20},15,0.35)`;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, h * 0.3, x - 4, h * 0.6, x + 2, h); g.stroke();
  }
  g.fillStyle = 'rgba(40,20,5,0.4)';
  for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 3);
}, true));

// 동굴 벽화 (조상들의 항해)
export const muralTexture = () => once('mural', () => canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#5d4b3a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e8d8b8'; g.fillStyle = '#e8d8b8'; g.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * 120, y = 150;
    g.beginPath(); g.moveTo(x - 40, y); g.quadraticCurveTo(x, y + 25, x + 40, y); g.stroke();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 70); g.lineTo(x + 35, y - 20); g.closePath(); g.stroke();
  }
  for (let x = 0; x < w; x += 30) { g.beginPath(); g.moveTo(x, 210); g.quadraticCurveTo(x + 15, 195, x + 30, 210); g.stroke(); }
  g.beginPath(); g.arc(440, 50, 22, 0, Math.PI * 2); g.fill();
}));
