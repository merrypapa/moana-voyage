// HUD: 체력, 배고픔, 소지품, 목표, 나침반, 바람, 알림
import { bearingName } from '../util.js';

const $ = (id) => document.getElementById(id);
const FOOD = [
  ['meal', '🍲'], ['fish', '🐟'], ['taro', '🥔'], ['breadfruit', '🍈'], ['banana', '🍌'], ['coconut', '🥥'],
];

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'), who: $('who'), hearts: $('hearts'), hunger: $('hunger'), inv: $('inventory'),
      objTitle: $('objTitle'), objText: $('objText'), objDist: $('objDist'), compass: $('compass'), arrow: $('compassArrow'),
      prompt: $('prompt'), toast: $('toast'), windArrow: $('windArrow'),
      transformBtn: document.querySelector('.tb-transform'), downBtn: document.querySelector('.tb-down'),
      actionBtn: document.querySelector('.tb-action'), jumpBtn: document.querySelector('.tb-jump'),
    };
    this.cache = {};
  }
  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  set(key, el, value, prop = 'textContent') {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  toast(text) {
    const d = document.createElement('div');
    d.className = 'toast-item';
    d.textContent = text;
    this.el.toast.appendChild(d);
    while (this.el.toast.children.length > 3) this.el.toast.firstChild.remove();
    setTimeout(() => d.remove(), 3300);
  }

  prompt(text) {
    if (!text) { if (this.cache.prompt !== null) { this.el.prompt.classList.add('hidden'); this.cache.prompt = null; } return; }
    const touch = this.game.input.touchUsed;
    const t = touch ? `👆 ${text}` : `[E] ${text}`;
    if (this.cache.prompt === t) return;
    this.cache.prompt = t;
    this.el.prompt.textContent = t;
    this.el.prompt.classList.remove('hidden');
  }

  update() {
    const g = this.game;
    const c = g.leader;
    this.set('who', this.el.who, `${c.kind === 'moana' ? '🌺' : '🪝'} ${c.name}${c.form === 'hawk' ? ' (매)' : ''}${c.running ? '<span class="running">🏃 달리는 중</span>' : ''}`, 'innerHTML');
    this.set('hearts', this.el.hearts, '❤️'.repeat(c.hp) + '🤍'.repeat(Math.max(0, c.maxHp - c.hp)));
    this.set('hunger', this.el.hunger, `${Math.round(c.hunger)}%`, 'title');
    this.el.hunger.style.width = `${c.hunger}%`;
    const inv = g.inventory;
    const invText = FOOD.filter(([k]) => inv[k] > 0).map(([k, e]) => `${e}${inv[k]}`).join('  ') + (g.moana.model.heart.visible || g.flags.hasHeart ? '  💚' : '') + (g.maui.hasHook ? '  🪝' : '');
    this.set('inv', this.el.inv, invText || '빈 손');

    // 목표
    const st = g.quests.stage;
    this.set('objTitle', this.el.objTitle, st.title);
    this.set('objText', this.el.objText, st.text);
    const tgt = g.quests.target();
    const p = c.worldPos();
    if (tgt && g.zone === (tgt.x > 7000 ? 'lalotai' : 'surface')) {
      const dx = tgt.x - p.x, dz = tgt.z - p.z;
      const d = Math.hypot(dx, dz);
      this.set('objDist', this.el.objDist, d > 30 ? `${bearingName(dx, dz)}쪽 ${d > 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm'}` : '바로 여기!');
      const rel = Math.atan2(dx, dz) - g.camRig.yaw;
      this.el.arrow.style.transform = `rotate(${-rel}rad)`;
      this.el.compass.style.display = '';
    } else {
      this.set('objDist', this.el.objDist, '');
      this.el.compass.style.display = 'none';
    }
    // 바람
    this.el.windArrow.style.transform = `rotate(${-(g.wind.yaw - g.camRig.yaw) - Math.PI / 2}rad)`;

    // 터치 버튼 상태
    const isMaui = c.kind === 'maui';
    this.el.transformBtn.classList.toggle('hidden', !isMaui);
    this.el.downBtn.classList.toggle('hidden', c.form !== 'hawk');
    this.set('jumpLabel', this.el.jumpBtn, c.form === 'hawk' ? '위로' : c.state === 'helm' ? '키<br/>놓기' : '점프', 'innerHTML');
    this.set('actLabel', this.el.actionBtn, isMaui ? (c.hasHook ? '갈고리' : '주먹') : inv.coconut > 0 ? '코코넛<br/>던지기' : '노<br/>휘두르기', 'innerHTML');
  }
}
