// 배경 음악: 이 게임을 위해 새로 만든 폴리네시아풍 항해 곡 (Web Audio로 실시간 연주)
// 악기: 통나무 북(토에레), 큰북(파후), 셰이커, 우쿨렐레, 베이스, 멜로디, "헤이!" 합창
// 분위기(mood): village(마을) · voyage(항해) · night(밤) · battle(전투)

const BPM = 118;
const STEP = 60 / BPM / 4; // 16분음표 길이

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 코드: 우쿨렐레 음(midi)과 베이스 근음
const CH = {
  D: { uke: [62, 66, 69, 74], bass: 38 },
  A: { uke: [61, 64, 69, 73], bass: 45 },
  Bm: { uke: [62, 66, 71, 74], bass: 47 },
  G: { uke: [62, 67, 71, 74], bass: 43 },
  Dm: { uke: [62, 65, 69, 74], bass: 38 },
  Bb: { uke: [62, 65, 70, 74], bass: 46 },
  C: { uke: [60, 64, 67, 72], bass: 48 },
};
const PROG_A = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'];
const PROG_B = ['G', 'A', 'D', 'Bm', 'G', 'A', 'D', 'D'];
const PROG_BATTLE = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'];

// 멜로디 [16분음표 위치, midi, 길이(16분음표 수)] — 마디별
const MEL_A = [
  [[0, 69, 2], [2, 71, 2], [4, 74, 4], [8, 71, 2], [10, 69, 2], [12, 66, 4]],
  [[0, 64, 2], [2, 66, 2], [4, 69, 6], [12, 64, 4]],
  [[0, 66, 2], [2, 69, 2], [4, 71, 4], [8, 74, 2], [10, 71, 2], [12, 69, 4]],
  [[0, 71, 4], [4, 69, 2], [6, 67, 2], [8, 66, 8]],
  [[0, 69, 2], [2, 71, 2], [4, 74, 4], [8, 76, 2], [10, 74, 2], [12, 71, 4]],
  [[0, 73, 4], [4, 76, 4], [8, 73, 2], [10, 69, 6]],
  [[0, 71, 2], [2, 74, 2], [4, 71, 2], [6, 69, 2], [8, 67, 4], [12, 71, 4]],
  [[0, 69, 12]],
];
const MEL_B = [
  [[0, 74, 2], [2, 74, 2], [4, 76, 2], [6, 74, 2], [8, 71, 4], [12, 67, 4]],
  [[0, 76, 2], [2, 76, 2], [4, 78, 2], [6, 76, 2], [8, 73, 4], [12, 69, 4]],
  [[0, 78, 4], [4, 76, 2], [6, 74, 2], [8, 69, 4], [12, 74, 4]],
  [[0, 71, 6], [6, 69, 2], [8, 66, 8]],
  [[0, 74, 2], [2, 71, 2], [4, 74, 2], [6, 76, 2], [8, 79, 4], [12, 78, 4]],
  [[0, 76, 4], [4, 73, 4], [8, 76, 2], [10, 78, 2], [12, 76, 4]],
  [[0, 74, 4], [4, 78, 4], [8, 81, 8]],
  [[0, 74, 12]],
];

const PAT = {
  pahu: { voyage: [0, 6, 8, 11], village: [0, 8], night: [], battle: [0, 3, 6, 8, 10, 11, 12, 14] },
  toere: { voyage: 'x.xxx.x.x.xxx.xx', village: '', night: '', battle: 'xxxxxxxxxxxxxxxx' },
  bass: { voyage: [0, 3, 6, 8, 11, 12, 14], village: [0, 6, 8, 12], night: [0, 8], battle: [0, 2, 4, 6, 8, 10, 12, 14] },
  uke: { voyage: [0, 3, 6, 8, 10, 12, 14], village: [0, 3, 6, 8, 10, 12, 14], night: [0, 6, 12], battle: [0, 3, 6, 8, 11, 14] },
};

const MOODS = {
  village: { drums: 0.6, bass: 0.8, uke: 0.9, mel: 0.85, chant: 0 },
  voyage: { drums: 1, bass: 1, uke: 1, mel: 1, chant: 1 },
  night: { drums: 0, bass: 0.5, uke: 0.7, mel: 0.55, chant: 0 },
  battle: { drums: 1.1, bass: 1, uke: 0.55, mel: 0, chant: 1 },
};

export class Music {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(dest);
    this.layers = {};
    for (const k of ['drums', 'bass', 'uke', 'mel', 'chant']) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.layers[k] = g;
    }
    this.mood = 'village';
    this.want = 'village';
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.15;
    this.enabled = true;
    this.ks = new Map();
    this.noiseBuf = this._noise();
    this.timer = setInterval(() => this.schedule(), 25);
    this.applyMood(0);
  }

  setMood(m) { if (MOODS[m]) this.want = m; }

  setEnabled(v) {
    this.enabled = v;
    this.out.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.3);
  }

  applyMood(t) {
    const m = MOODS[this.mood];
    for (const [k, g] of Object.entries(this.layers)) g.gain.setTargetAtTime(m[k], t || this.ctx.currentTime, 0.4);
  }

  schedule() {
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.05; // 탭이 숨겨졌다 돌아오면 건너뛰기
    while (this.nextTime < now + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
    }
  }

  playStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    if (s === 0 && this.want !== this.mood) {
      this.mood = this.want;
      this.applyMood(t);
    }
    if (!this.enabled) return;
    const mood = this.mood;
    const inB = bar % 16 >= 8;
    const bi = bar % 8;
    const prog = mood === 'battle' ? PROG_BATTLE : inB ? PROG_B : PROG_A;
    const chord = CH[prog[bi]];

    // 북
    if (PAT.pahu[mood].includes(s)) this.pahu(t, s === 0 ? 1 : 0.7);
    const toe = PAT.toere[mood];
    if (toe && toe[s] === 'x') this.toere(t, s % 4 === 0 ? 1 : 0.6, s % 2 ? 820 : 640);
    if (mood !== 'night') this.shaker(t, s % 4 === 2 ? 1 : 0.55);

    // 베이스
    if (PAT.bass[mood].includes(s)) {
      let n = chord.bass;
      if (mood === 'voyage' && (s === 3 || s === 14)) n += 12;
      if (mood === 'voyage' && s === 11) n += 7;
      this.bass(t, n, mood === 'battle' ? 0.9 : 1);
    }

    // 우쿨렐레
    const uk = PAT.uke[mood];
    const ui = uk.indexOf(s);
    if (ui >= 0) {
      if (mood === 'night') this.pluck(t, chord.uke[(bar + ui) % 4] + 12, 0.35, this.layers.uke);
      else this.strum(t, chord.uke, ui % 2 === 1, s === 0 || s === 8 ? 1 : 0.65);
    }

    // 멜로디 (밤에는 A 부분만, 전투에는 없음)
    if (mood !== 'battle' && !(mood === 'night' && inB) && bar >= 2) {
      const mel = (inB ? MEL_B : MEL_A)[bi];
      for (const [pos, note, len] of mel) if (pos === s) this.lead(t, note, len * STEP);
    }

    // 헤이! 합창
    if (mood === 'voyage' && inB && ((bi === 3 && s === 12) || (bi === 7 && (s === 8 || s === 12)))) this.hey(t);
    if (mood === 'battle' && bi % 4 === 3 && s === 12) this.hey(t);
  }

  // ---------- 악기 ----------
  _noise() {
    const len = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  env(t, dest, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  noiseHit(t, dest, { type = 'highpass', freq = 6000, q = 1, vol = 0.1, decay = 0.05 }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.env(t, dest, vol, 0.002, decay);
    src.connect(f); f.connect(g);
    src.start(t, Math.random() * 0.5, decay + 0.05);
  }

  pahu(t, v) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    o.connect(this.env(t, this.layers.drums, 0.75 * v, 0.004, 0.38));
    o.start(t); o.stop(t + 0.45);
    this.noiseHit(t, this.layers.drums, { type: 'lowpass', freq: 500, vol: 0.12 * v, decay: 0.05 });
  }

  toere(t, v, freq) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(freq * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.015);
    o.connect(this.env(t, this.layers.drums, 0.22 * v, 0.002, 0.07));
    o.start(t); o.stop(t + 0.1);
    this.noiseHit(t, this.layers.drums, { type: 'bandpass', freq: freq * 3, q: 3, vol: 0.08 * v, decay: 0.025 });
  }

  shaker(t, v) { this.noiseHit(t, this.layers.drums, { freq: 7000, vol: 0.05 * v, decay: 0.045 }); }

  bass(t, note, v) {
    const f = midiHz(note);
    for (const [type, vol] of [['triangle', 0.32], ['sine', 0.3]]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = type === 'sine' ? f / 2 : f;
      o.connect(this.env(t, this.layers.bass, vol * v, 0.008, 0.26));
      o.start(t); o.stop(t + 0.32);
    }
  }

  // 카플러스-스트롱 현 소리 (우쿨렐레)
  ksBuffer(note) {
    if (this.ks.has(note)) return this.ks.get(note);
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 1.3);
    const b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / midiHz(note)));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % N;
      const v = (ring[idx] + ring[next]) * 0.4985;
      d[i] = ring[idx];
      ring[idx] = v;
      idx = next;
    }
    this.ks.set(note, b);
    return b;
  }

  pluck(t, note, vol, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.ksBuffer(note);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 3200;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t);
    src.stop(t + 1.2);
  }

  strum(t, notes, up, v) {
    const order = up ? [...notes].reverse() : notes;
    order.forEach((n, i) => this.pluck(t + i * 0.014, n, 0.16 * v * (up ? 0.75 : 1), this.layers.uke));
  }

  lead(t, note, dur) {
    const f = midiHz(note);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    g.gain.setTargetAtTime(0.08, t + 0.05, 0.1);
    g.gain.setTargetAtTime(0.0001, t + Math.max(0.06, dur - 0.04), 0.05);
    o.connect(g); g.connect(this.layers.mel);
    o.start(t); o.stop(t + dur + 0.3);
    this.pluck(t, note, 0.2, this.layers.mel);
  }

  hey(t) {
    for (const [f, det] of [[190, -6], [200, 0], [240, 7]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.12, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      o.detune.value = det;
      const b1 = this.ctx.createBiquadFilter();
      b1.type = 'bandpass'; b1.frequency.value = 750; b1.Q.value = 4;
      const b2 = this.ctx.createBiquadFilter();
      b2.type = 'bandpass'; b2.frequency.value = 1250; b2.Q.value = 5;
      const g = this.env(t, this.layers.chant, 0.5, 0.01, 0.2);
      o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g);
      o.start(t); o.stop(t + 0.3);
    }
    this.noiseHit(t, this.layers.chant, { type: 'bandpass', freq: 2500, q: 1, vol: 0.12, decay: 0.08 });
  }
}
