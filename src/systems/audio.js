// 소리: 외부 파일 없이 Web Audio로 합성 (파도, 북, 효과음, 배경 음악)
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.music = true;
    this.musicT = 0;
    this.step = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.35; this.bgm.connect(this.master);
    // 파도 소리 (필터 거친 잡음)
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    this.noiseBuf = buf;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    this.oceanGain = this.ctx.createGain(); this.oceanGain.gain.value = 0.25;
    src.connect(lp); lp.connect(this.oceanGain); this.oceanGain.connect(this.master);
    src.start();
    this.lfoT = 0;
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.6 : 0;
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005, dest } = {}) {
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { freq = 1000, vol = 0.3, type = 'lowpass', dest } = {}) {
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'jump': this.tone(300, 0.15, { type: 'triangle', slide: 250, vol: 0.12 }); break;
      case 'splash': this.noise(0.6, { freq: 1500, vol: 0.5 }); break;
      case 'wave': this.noise(1.4, { freq: 700, vol: 0.5 }); this.tone(220, 1.2, { slide: 220, vol: 0.12 }); break;
      case 'bok': this.tone(700, 0.08, { type: 'square', slide: -300, vol: 0.1 }); setTimeout(() => this.tone(650, 0.1, { type: 'square', slide: -350, vol: 0.1 }), 110); break;
      case 'oink': this.tone(180, 0.2, { type: 'sawtooth', slide: -60, vol: 0.12 }); break;
      case 'pickup': this.tone(660, 0.1, { type: 'triangle', vol: 0.2 }); setTimeout(() => this.tone(990, 0.15, { type: 'triangle', vol: 0.2 }), 80); break;
      case 'shake': this.noise(0.4, { freq: 3000, vol: 0.15, type: 'highpass' }); break;
      case 'cook': this.noise(0.8, { freq: 4000, vol: 0.15, type: 'highpass' }); this.tone(520, 0.3, { type: 'triangle', vol: 0.15 }); break;
      case 'eat': for (let i = 0; i < 3; i++) setTimeout(() => this.noise(0.08, { freq: 2500, vol: 0.2 }), i * 120); break;
      case 'drum': [0, 180, 360].forEach((d) => setTimeout(() => { this.tone(110, 0.4, { slide: -50, vol: 0.6 }); this.noise(0.1, { freq: 400, vol: 0.3 }); }, d)); break;
      case 'quest': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, { type: 'triangle', vol: 0.18 }), i * 110)); break;
      case 'restore': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.9, { type: 'sine', vol: 0.2 }), i * 180)); break;
      case 'transform': this.noise(0.4, { freq: 2000, vol: 0.2 }); this.tone(400, 0.4, { slide: 800, vol: 0.15 }); break;
      case 'hawk': this.tone(2400, 0.5, { slide: -1400, vol: 0.12, type: 'sawtooth' }); break;
      case 'swish': this.noise(0.18, { freq: 2500, vol: 0.2, type: 'bandpass' }); break;
      case 'smash': this.noise(0.3, { freq: 600, vol: 0.5 }); this.tone(90, 0.4, { slide: -40, vol: 0.5 }); break;
      case 'throw': this.noise(0.15, { freq: 1800, vol: 0.15, type: 'bandpass' }); break;
      case 'bonk': this.tone(320, 0.12, { type: 'square', slide: -120, vol: 0.15 }); break;
      case 'crash': this.noise(0.8, { freq: 900, vol: 0.5 }); this.tone(80, 0.5, { slide: -30, vol: 0.4 }); break;
      case 'hurt': this.tone(220, 0.25, { type: 'sawtooth', slide: -100, vol: 0.15 }); break;
      case 'whoosh': this.noise(1.2, { freq: 500, vol: 0.3, type: 'bandpass' }); break;
      case 'boom': this.noise(1.2, { freq: 300, vol: 0.8 }); this.tone(60, 0.8, { slide: -30, vol: 0.5 }); break;
      case 'rumble': this.noise(2.2, { freq: 150, vol: 0.8 }); break;
      case 'thunder': this.noise(2, { freq: 400, vol: 0.9 }); break;
      case 'sparkle': [1320, 1760, 2093, 2637].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, { type: 'sine', vol: 0.1 }), i * 70)); break;
      case 'blip': this.tone(880, 0.04, { type: 'triangle', vol: 0.05 }); break;
      default: break;
    }
  }

  // 통나무 북 + 우쿨렐레 느낌의 5음계 배경 음악
  update(dt, { sailing = false, storm = 0, night = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    this.lfoT += dt;
    this.oceanGain.gain.value = 0.18 + Math.sin(this.lfoT * 0.4) * 0.07 + (sailing ? 0.1 : 0) + storm * 0.3;
    if (!this.music) return;
    this.musicT -= dt;
    if (this.musicT > 0) return;
    const beat = 0.32;
    this.musicT += beat;
    const s = this.step++;
    const bar = Math.floor(s / 8) % 4;
    const b = s % 8;
    // 북
    if (b === 0 || b === 3 || b === 6) this.tone(b === 0 ? 98 : 130, 0.25, { slide: -40, vol: 0.35, dest: this.bgm });
    if (b === 2 || b === 5 || b === 7) this.noise(0.05, { freq: 3000, vol: 0.06, type: 'highpass', dest: this.bgm });
    // 멜로디 (5음계)
    const scale = [392, 440, 523, 587, 659, 784, 880];
    const pattern = [[0, 2, 4, 2, 3, 1, 2, -1], [4, 5, 4, 2, 3, 2, 1, -1], [2, 4, 5, 6, 5, 4, 2, 3], [4, 2, 1, 0, 1, 2, 0, -1]][bar];
    const n = pattern[b];
    if (n >= 0 && (s % 2 === 0 || n > 3)) {
      const f = scale[n] * (night > 0.5 ? 0.5 : 1);
      this.tone(f, 0.45, { type: 'triangle', vol: 0.09, dest: this.bgm });
      this.tone(f * 2, 0.2, { type: 'sine', vol: 0.03, dest: this.bgm });
    }
  }
}
