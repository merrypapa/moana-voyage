// 지도: 발견한 섬, 배/캐릭터 위치, 목표
import { ISLANDS, WORLD, REEF } from '../config.js';
import { islandHeight } from '../world/terrain.js';

const FOG_N = 64;

export class WorldMap {
  constructor(game) {
    this.game = game;
    this.overlay = document.getElementById('mapOverlay');
    this.canvas = document.getElementById('mapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.fog = new Uint8Array(FOG_N * FOG_N);
    this.discovered = new Set();
    this.open = false;
    this.islandImgs = new Map();
    document.getElementById('btnMapClose').addEventListener('click', () => this.toggle(false));
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.toggle(false); });
  }

  toggle(v = !this.open) {
    this.open = v;
    this.overlay.classList.toggle('hidden', !v);
    if (v) this.draw();
  }

  // 월드 → 지도 픽셀
  toMap(x, z) {
    const S = this.canvas.width;
    return [((x + WORLD.half) / (WORLD.half * 2)) * S, ((z + WORLD.half) / (WORLD.half * 2)) * S];
  }

  reveal(x, z, radius) {
    const cell = (WORLD.half * 2) / FOG_N;
    const r = Math.ceil(radius / cell);
    const cx = Math.floor((x + WORLD.half) / cell), cz = Math.floor((z + WORLD.half) / cell);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = cx + i, Z = cz + j;
      if (X < 0 || Z < 0 || X >= FOG_N || Z >= FOG_N) continue;
      if ((i * i + j * j) * cell * cell <= radius * radius) this.fog[Z * FOG_N + X] = 1;
    }
    for (const isl of ISLANDS) {
      if (this.discovered.has(isl.id) || isl.lavaRing) continue;
      if (Math.hypot(isl.x - x, isl.z - z) < radius + isl.radius) {
        this.discovered.add(isl.id);
        if (this.game.started && !isl.startDiscovered) this.game.hud.toast(`🗺️ 새로운 섬 발견: ${isl.name}`);
      }
    }
  }

  islandImage(isl) {
    const key = isl.id + (isl.restored ? 'r' : '') + (isl.sink > 1 ? 's' : '');
    if (this.islandImgs.has(key)) return this.islandImgs.get(key);
    const S = this.canvas.width;
    const R = isl.radius * 1.2;
    const px = Math.max(8, Math.ceil((R * 2 / (WORLD.half * 2)) * S));
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const img = g.createImageData(px, px);
    for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
      const x = isl.x - R + (i / px) * R * 2, z = isl.z - R + (j / px) * R * 2;
      const h = islandHeight(isl, x, z);
      const k = (j * px + i) * 4;
      if (h > 0) {
        let col = h < 2 ? [226, 204, 150] : isl.type === 'lava' && !isl.restored ? [70, 40, 34] : isl.type === 'dark' ? [90, 80, 110] : [80, 150, 80];
        if (isl.blighted && !isl.restored && isl.type !== 'lava') col = [140, 135, 128];
        const shade = Math.min(1, 0.75 + h / 120);
        img.data[k] = col[0] * shade; img.data[k + 1] = col[1] * shade; img.data[k + 2] = col[2] * shade; img.data[k + 3] = 255;
      } else if (h > -6) {
        img.data[k] = 150; img.data[k + 1] = 210; img.data[k + 2] = 200; img.data[k + 3] = 160;
      }
    }
    g.putImageData(img, 0, 0);
    const out = { canvas: c, R };
    this.islandImgs.set(key, out);
    return out;
  }

  draw() {
    const g = this.game;
    const ctx = this.ctx;
    const S = this.canvas.width;
    ctx.fillStyle = '#6fb6cf';
    ctx.fillRect(0, 0, S, S);
    // 바다 결
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let y = 20; y < S; y += 28) {
      ctx.beginPath();
      for (let x = 0; x <= S; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
      ctx.stroke();
    }
    // 암초
    const [rx, rz] = this.toMap(REEF.x, REEF.z);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(rx, rz, (REEF.r / (WORLD.half * 2)) * S, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 섬
    for (const isl of ISLANDS) {
      if (isl.sink > 1 && !this.discovered.has(isl.id)) continue;
      const known = this.discovered.has(isl.id) || (isl.lavaRing && this.discovered.has('tefiti'));
      if (!known) continue;
      const im = this.islandImage(isl);
      const [x0, z0] = this.toMap(isl.x - im.R, isl.z - im.R);
      const [x1] = this.toMap(isl.x + im.R, isl.z);
      if (isl.sink > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc((x0 + x1) / 2, z0 + (x1 - x0) / 2, (x1 - x0) / 3, 0, Math.PI * 2); ctx.fill();
      } else ctx.drawImage(im.canvas, x0, z0, x1 - x0, x1 - x0);
    }
    // 안개 (가 보지 않은 곳)
    const cell = S / FOG_N;
    ctx.fillStyle = 'rgba(233,215,174,0.93)';
    for (let j = 0; j < FOG_N; j++) for (let i = 0; i < FOG_N; i++) {
      if (!this.fog[j * FOG_N + i]) ctx.fillRect(i * cell - 0.5, j * cell - 0.5, cell + 1, cell + 1);
    }
    // 이름표
    ctx.font = 'bold 15px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    for (const isl of ISLANDS) {
      if (isl.lavaRing || !this.discovered.has(isl.id)) continue;
      const [x, z] = this.toMap(isl.x, isl.z);
      const label = isl.sink > 1 ? `${isl.name} (바닷속)` : isl.name;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(label, x, z - (isl.radius / (WORLD.half * 2)) * S - 6);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillText(label, x, z - (isl.radius / (WORLD.half * 2)) * S - 6);
    }
    // 목표
    const tgt = g.quests.target();
    if (tgt && tgt.x < 7000) {
      const [x, z] = this.toMap(tgt.x, tgt.z);
      ctx.font = '26px sans-serif';
      ctx.fillText('⭐', x, z + 9);
    }
    // 배와 캐릭터
    const b = g.boat;
    if (b.unlocked) {
      const [bx, bz] = this.toMap(b.x, b.z);
      ctx.save();
      ctx.translate(bx, bz);
      ctx.rotate(-b.yaw + Math.PI);
      ctx.fillStyle = '#7a4a28';
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f3e2b3';
      ctx.fillRect(-1, -4, 6, 7);
      ctx.restore();
    }
    for (const c of g.characters) {
      if (g.zone !== 'surface') continue;
      const p = c.worldPos();
      const [x, z] = this.toMap(p.x, p.z);
      ctx.fillStyle = c.kind === 'moana' ? '#ff7a5c' : '#ffd76e';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, z, c === g.leader ? 6 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // 나침반 장미
    ctx.fillStyle = '#3a2a1a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('북', S - 40, 40);
    ctx.beginPath(); ctx.moveTo(S - 40, 48); ctx.lineTo(S - 46, 70); ctx.lineTo(S - 34, 70); ctx.closePath(); ctx.fill();
  }

  serialize() {
    return { fog: Array.from(this.fog).map(String).join(''), disc: [...this.discovered] };
  }
  load(d) {
    if (!d) return;
    if (d.fog) for (let i = 0; i < d.fog.length && i < this.fog.length; i++) this.fog[i] = d.fog[i] === '1' ? 1 : 0;
    if (d.disc) d.disc.forEach((id) => this.discovered.add(id));
  }
}
