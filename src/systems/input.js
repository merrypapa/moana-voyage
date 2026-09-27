// 입력: 키보드 + 마우스 + 터치(가상 조이스틱, 버튼)
// 모든 입력은 "플레이어 명령" 형태로 정리됩니다. 나중에 2인 온라인 플레이에서는
// 원격 플레이어의 명령이 같은 형태(PlayerCommand)로 들어오게 됩니다.

export function emptyCommand() {
  return {
    moveX: 0, moveY: 0, // 조이스틱 (오른쪽 +, 앞 +)
    run: false, jumpHeld: false, downHeld: false,
    jump: false, interact: false, action: false, transform: false, eat: false,
  };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'run', ShiftRight: 'run', KeyE: 'interact', KeyF: 'action', KeyQ: 'transform', KeyR: 'eat',
  KeyM: 'map', Tab: 'switch', Escape: 'menu', Enter: 'confirm', KeyC: 'descend', ControlLeft: 'descend',
};

export class Input {
  constructor(canvas) {
    this.held = new Set();
    this.pressed = new Set();
    this.camDX = 0; this.camDY = 0; this.zoom = 0;
    this.joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.touchUsed = false;
    this.runToggle = false; // 아이패드 [달리기] 버튼: 누르면 켜지고 다시 누르면 꺼짐
    this.onFirstTouch = null;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.held.delete(k);
    });
    window.addEventListener('blur', () => this.held.clear());

    // 마우스: 드래그로 카메라 회전, 휠로 줌
    let dragging = false, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.camDX += e.clientX - lx; this.camDY += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    // 터치: 화면 오른쪽 드래그 = 카메라, 조이스틱, 두 손가락 핀치 = 줌
    this.camTouches = new Map();
    canvas.addEventListener('touchstart', (e) => {
      this._firstTouch();
      for (const t of e.changedTouches) this.camTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (this.camTouches.size >= 2) {
        const pts = [...e.touches].filter((t) => this.camTouches.has(t.identifier)).slice(0, 2);
        if (pts.length === 2) {
          const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
          if (this._pinch) this.zoom += (this._pinch - d) * 0.03;
          this._pinch = d;
        }
      } else {
        for (const t of e.changedTouches) {
          const p = this.camTouches.get(t.identifier);
          if (!p) continue;
          this.camDX += (t.clientX - p.x) * 1.3; this.camDY += (t.clientY - p.y) * 1.3;
          p.x = t.clientX; p.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endCam = (e) => {
      for (const t of e.changedTouches) this.camTouches.delete(t.identifier);
      if (this.camTouches.size < 2) this._pinch = null;
    };
    canvas.addEventListener('touchend', endCam);
    canvas.addEventListener('touchcancel', endCam);

    this._setupJoystick();
    this._setupButtons();
  }

  _firstTouch() {
    if (this.touchUsed) return;
    this.touchUsed = true;
    document.getElementById('touch').classList.remove('hidden');
    if (this.onFirstTouch) this.onFirstTouch();
  }

  _setupJoystick() {
    const base = document.getElementById('joy');
    const knob = document.getElementById('joyKnob');
    const R = 60;
    const move = (t) => {
      let dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy;
      const L = Math.hypot(dx, dy);
      if (L > R) { dx *= R / L; dy *= R / L; }
      this.joy.x = dx / R; this.joy.y = -dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    base.addEventListener('touchstart', (e) => {
      this._firstTouch();
      const t = e.changedTouches[0];
      const r = base.getBoundingClientRect();
      this.joy.id = t.identifier; this.joy.cx = r.left + r.width / 2; this.joy.cy = r.top + r.height / 2;
      move(t);
      e.preventDefault();
    }, { passive: false });
    base.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.joy.id) move(t);
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy.id = null; this.joy.x = 0; this.joy.y = 0;
          knob.style.transform = '';
        }
      }
    };
    base.addEventListener('touchend', end);
    base.addEventListener('touchcancel', end);
  }

  _setupButtons() {
    const map = { jump: 'jump', interact: 'interact', action: 'action', transform: 'transform', down: 'descend', eat: 'eat' };
    const runBtn = document.querySelector('.tb-run');
    const toggleRun = (e) => {
      this._firstTouch();
      this.runToggle = !this.runToggle;
      runBtn.classList.toggle('on', this.runToggle);
      if (e) e.preventDefault();
    };
    runBtn.addEventListener('touchstart', toggleRun, { passive: false });
    runBtn.addEventListener('mousedown', () => toggleRun());
    this.setRunToggle = (v) => { this.runToggle = v; runBtn.classList.toggle('on', v); };
    for (const btn of document.querySelectorAll('#touchButtons .tb')) {
      if (btn.dataset.act === 'run') continue;
      const k = map[btn.dataset.act];
      btn.addEventListener('touchstart', (e) => {
        this._firstTouch();
        if (!this.held.has(k)) this.pressed.add(k);
        this.held.add(k);
        btn.classList.add('pressed');
        e.preventDefault();
      }, { passive: false });
      const up = (e) => { this.held.delete(k); btn.classList.remove('pressed'); e.preventDefault(); };
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
      btn.addEventListener('mousedown', () => { this.pressed.add(k); this.held.add(k); });
      btn.addEventListener('mouseup', () => this.held.delete(k));
    }
  }

  // 한 프레임 동안의 로컬 플레이어 명령
  command() {
    const c = emptyCommand();
    if (!this.enabled) return c;
    let x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let y = (this.held.has('up') ? 1 : 0) - (this.held.has('down') ? 1 : 0);
    if (this.joy.id !== null) { x = this.joy.x; y = this.joy.y; }
    const L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    c.moveX = x; c.moveY = y;
    c.run = L > 0.1 && (this.held.has('run') || this.runToggle || (this.joy.id !== null && L > 0.92));
    c.jumpHeld = this.held.has('jump');
    c.downHeld = this.held.has('descend');
    c.jump = this.pressed.has('jump');
    c.interact = this.pressed.has('interact');
    c.action = this.pressed.has('action');
    c.transform = this.pressed.has('transform');
    c.eat = this.pressed.has('eat');
    return c;
  }

  consume(k) {
    const had = this.pressed.has(k);
    this.pressed.delete(k);
    return had;
  }

  endFrame() {
    this.pressed.clear();
    this.camDX = 0; this.camDY = 0; this.zoom = 0;
  }
}
