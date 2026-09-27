// 파티클 효과: 물보라, 변신 연기, 폭발, 반짝이
import * as THREE from 'three';

export class Effects {
  constructor(game) {
    this.game = game;
    this.parts = [];
    this.geo = new THREE.IcosahedronGeometry(1, 0);
    this.mats = {
      splash: new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true }),
      poof: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }),
      fire: new THREE.MeshBasicMaterial({ color: '#ff7a20', transparent: true }),
      smoke: new THREE.MeshBasicMaterial({ color: '#555', transparent: true }),
      spark: new THREE.MeshBasicMaterial({ color: '#7dffcf', transparent: true }),
      gold: new THREE.MeshBasicMaterial({ color: '#ffd76e', transparent: true }),
      leaf: new THREE.MeshBasicMaterial({ color: '#5fd35a', transparent: true }),
      dust: new THREE.MeshBasicMaterial({ color: '#e8d8b0', transparent: true }),
    };
    this.shake = 0;
    this.flashEl = document.getElementById('fade');
  }

  emit(kind, pos, n, { speed = 4, up = 4, size = 0.3, life = 1, gravity = 12 } = {}) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo, this.mats[kind].clone());
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      const p = {
        m, life: life * (0.6 + Math.random() * 0.4), max: 0,
        v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random() * 0.8), Math.sin(a) * s),
        size: size * (0.6 + Math.random() * 0.8), gravity,
      };
      p.max = p.life;
      m.scale.setScalar(p.size);
      this.game.scene.add(m);
      this.parts.push(p);
    }
  }

  splash(pos, k = 1) { this.emit('splash', pos, Math.floor(14 * k), { speed: 3 * k, up: 6 * k, size: 0.25 * k, life: 0.9 }); }
  poof(pos) { this.emit('poof', pos, 24, { speed: 4, up: 2, size: 0.5, life: 0.8, gravity: -2 }); this.emit('spark', pos, 10, { speed: 5, up: 3, size: 0.15, life: 1 }); }
  explode(pos, k = 1) {
    this.emit('fire', pos, Math.floor(20 * k), { speed: 8 * k, up: 10 * k, size: 0.8 * k, life: 1.1 });
    this.emit('smoke', pos, Math.floor(10 * k), { speed: 3 * k, up: 4, size: 1.4 * k, life: 1.8, gravity: -1 });
    this.shake = Math.max(this.shake, 0.5 * k);
  }
  sparkle(pos, kind = 'spark', n = 16) { this.emit(kind, pos, n, { speed: 3, up: 5, size: 0.18, life: 1.4, gravity: 2 }); }
  leaves(pos, n = 30) { this.emit('leaf', pos, n, { speed: 10, up: 12, size: 0.5, life: 3, gravity: 3 }); }

  flash(color = 'rgba(255,60,40,0.35)') {
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.5s';
      el.style.opacity = '0';
    });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.m.position.addScaledVector(p.v, dt);
      const k = Math.max(0, p.life / p.max);
      p.m.material.opacity = k;
      p.m.scale.setScalar(p.size * (0.5 + k * 0.5));
      if (p.life <= 0) {
        this.game.scene.remove(p.m);
        p.m.material.dispose();
        this.parts.splice(i, 1);
      }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
  }
}
