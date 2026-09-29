// 대화창: 한 줄씩 타자기처럼 보여주기
export class Dialog {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('dialog');
    this.nameEl = document.getElementById('dlgName');
    this.textEl = document.getElementById('dlgText');
    this.queue = [];
    this.onDone = null;
    this.active = false;
    this.typing = 0;
    this.full = '';
    this.el.addEventListener('click', () => this.next());
    this.el.addEventListener('touchstart', (e) => { e.preventDefault(); this.next(); }, { passive: false });
    this.pending = [];
  }

  show(lines, onDone) {
    if (!lines || !lines.length) { onDone && onDone(); return; }
    // 같은 대사가 이미 떠 있거나 기다리는 중이면 무시
    if (this.active && (this.current === lines || this.pending.some((p) => p.lines === lines))) return;
    if (this.active) {
      // 이미 대화 중이면 뒤에 이어서
      this.pending.push({ lines, onDone });
      return;
    }
    this.queue = lines.slice();
    this.current = lines;
    this.onDone = onDone || null;
    this.active = true;
    this.el.classList.remove('hidden');
    this.showLine();
  }

  showLine() {
    this.lineNo = (this.lineNo || 0) + 1;
    const l = this.queue.shift();
    this.nameEl.textContent = l.who || '';
    this.full = l.text;
    this.typing = 0;
    this.textEl.textContent = '';
    this.game.audio.play('blip');
  }

  // ---------- 2인 플레이 ----------
  netState() { return [this.active ? 1 : 0, this.nameEl.textContent, this.full, this.lineNo || 0]; }
  netApply([active, who, text, lineNo]) {
    if (!active) {
      if (this.active) { this.active = false; this.el.classList.add('hidden'); }
      return;
    }
    if (!this.active) { this.active = true; this.el.classList.remove('hidden'); }
    if (lineNo !== this.lineNo) {
      this.lineNo = lineNo;
      this.nameEl.textContent = who;
      this.full = text;
      this.typing = 0;
      this.textEl.textContent = '';
      this.game.audio.play('blip');
    }
  }

  next() {
    if (!this.active) return;
    if (this.game.netRole === 'guest') {
      // 참가자: 글자가 다 나왔으면 주인에게 "다음" 요청
      if (this.typing < this.full.length) { this.typing = this.full.length; this.textEl.textContent = this.full; return; }
      this.game.netSend({ type: 'dnext' });
      return;
    }
    if (this.typing < this.full.length) { this.typing = this.full.length; this.textEl.textContent = this.full; return; }
    if (this.queue.length) { this.showLine(); return; }
    this.active = false;
    this.el.classList.add('hidden');
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
    if (!this.active && this.pending.length) {
      const p = this.pending.shift();
      this.show(p.lines, p.onDone);
    }
  }

  update(dt, input) {
    if (!this.active) return;
    if (this.typing < this.full.length) {
      this.typing = Math.min(this.full.length, this.typing + dt * 40);
      this.textEl.textContent = this.full.slice(0, Math.floor(this.typing));
    }
    if (input.consume('confirm') || input.consume('interact') || input.consume('jump')) this.next();
  }
}
