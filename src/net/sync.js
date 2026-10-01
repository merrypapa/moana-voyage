// 2인 플레이 동기화
// 주인(모아나): 게임 전체를 계산 → 1초에 20번 상태(snapshot)와 이벤트를 보냄
// 참가자(마우이): 조작을 보냄 → 받은 상태를 부드럽게 따라가며 그리기만 함
import * as THREE from 'three';
import { emptyCommand } from '../systems/input.js';
import { Turtle } from '../entities/turtles.js';
import { updateReefFoam } from '../world/world.js';
import { approachAngle } from '../util.js';

const SNAP_RATE = 1 / 20;
const CMD_RATE = 1 / 30;
const EDGES = ['jump', 'interact', 'action', 'transform', 'eat', 'helm'];
const r2 = (v) => Math.round(v * 100) / 100;

// ---------------- 공통: 몸체 상태 ----------------
function bodyState(e) {
  const p = e.state === 'stolen' ? e.mesh.getWorldPosition(new THREE.Vector3()) : e.pos;
  return {
    b: e.onBoat ? 1 : 0, p: [r2(p.x), r2(p.y), r2(p.z)], f: r2(e.facing), s: e.state,
    v: e.mesh.visible ? 1 : 0, sp: Math.round((e.speedNow || 0) * 10) / 10,
  };
}

// ---------------- 주인 ----------------
export function setupHost(game, session) {
  game.netRole = 'host';
  game.session = session;
  game.netEvents = [];
  game.remote = { cmd: emptyCommand(), edges: new Set(), active: false };
  game.snapTimer = 0;
  game.snapCount = 0;
  wrapForEvents(game);
  session.isStale = () => performance.now() - (game.remote.lastMsg || 0) > 4000;
  session.on('open', () => {
    game.remote.lastMsg = performance.now();
    game.remote.active = true;
    game.maui.controlledBy = 'remote';
    game.forceFull = true;
    game.hud.toast('👫 마우이가 들어왔어요! 함께 모험해요');
    const st = document.getElementById('hostStatus');
    if (st) st.textContent = '🪝 마우이가 들어왔어요! 시작해 보세요';
    game.audio.play('quest');
    game.updateNetBadge();
  });
  session.on('close', () => {
    game.remote.active = false;
    game.maui.controlledBy = 'ai';
    game.hud.toast('마우이가 나갔어요. 다시 들어올 때까지 마우이는 혼자 따라와요.');
    game.updateNetBadge();
  });
  session.on('data', (msg) => hostReceive(game, msg));
}

function hostReceive(game, msg) {
  if (!msg || !msg.type) return;
  game.remote.lastMsg = performance.now();
  if (msg.type === 'cmd') {
    const R = game.remote;
    Object.assign(R.cmd, msg.c);
    for (const e of msg.e || []) R.edges.add(e);
  } else if (msg.type === 'dnext') {
    const d = game.dialog;
    if (d.active) { d.typing = d.full.length; d.next(); }
  } else if (msg.type === 'hello') {
    game.forceFull = true;
  }
}

// 마우이(참가자)의 이번 프레임 명령
export function takeRemoteCommand(game, blocked) {
  const R = game.remote;
  const c = emptyCommand();
  if (!blocked) {
    Object.assign(c, R.cmd);
    for (const e of EDGES) c[e] = R.edges.has(e);
  } else c.camYaw = R.cmd.camYaw;
  for (const e of EDGES) c[e] = c[e] || false;
  R.edges.clear();
  return c;
}

// 효과음, 파티클, 알림을 참가자에게도 보내기
function wrapForEvents(game) {
  const ev = (e) => { if (game.remote && game.remote.active) game.netEvents.push(e); };
  const fx = game.effects;
  const emit = fx.emit.bind(fx);
  fx.emit = (kind, pos, n, opts) => { ev(['fx', kind, r2(pos.x), r2(pos.y), r2(pos.z), n, opts || null]); return emit(kind, pos, n, opts); };
  const flash = fx.flash.bind(fx);
  fx.flash = (color) => { ev(['flash', color || null]); return flash(color); };
  const play = game.audio.play.bind(game.audio);
  game.audio.play = (name) => { if (name !== 'blip') ev(['snd', name]); return play(name); };
  const toast = game.hud.toast.bind(game.hud);
  game.hud.toast = (text) => { ev(['toast', text]); return toast(text); };
  const big = game.showBigText.bind(game);
  game.showBigText = (a, b) => { ev(['big', a, b]); return big(a, b); };
}

export function hostTick(game, dt) {
  if (!game.remote || !game.remote.active) return;
  // 4초 동안 아무 신호가 없으면 마우이가 나간 것으로 본다
  if (game.session.isStale()) { game.session.dropConnection(); return; }
  game.snapTimer += dt;
  if (game.snapTimer < SNAP_RATE) return;
  game.snapTimer = 0;
  game.snapCount++;
  game.session.send(buildSnapshot(game));
}

function buildSnapshot(game) {
  const full = game.forceFull || game.snapCount % 20 === 0;
  game.forceFull = false;
  const ch = (c) => ({
    ...bodyState(c), fm: c.form, hp: c.hp, mh: c.maxHp, hu: Math.round(c.hunger), hk: c.hasHook ? 1 : 0,
    sw: r2(c.swing), cm: c.climbMoving ? 1 : 0, rn: c.running ? 1 : 0, fl: c.flapping ? 1 : 0, iv: c.invuln > 0 ? 1 : 0,
  });
  const cr = (c) => ({ ...bodyState(c), car: c.carrier ? c.carrier.kind : 0 });
  const snap = {
    type: 'snap', t: r2(game.time), tod: Math.round(game.timeOfDay * 10000) / 10000, wy: r2(game.wind.yaw), z: game.zone,
    q: game.quests.index, inv: game.inventory, sh: r2(game.effects.shake),
    boat: game.boat.netState(),
    ch: { moana: ch(game.moana), maui: ch(game.maui) },
    cr: { heihei: cr(game.heihei), pua: cr(game.pua) },
    tu: game.turtles.map((t) => ({ id: t.nid, bb: t.baby ? 1 : 0, cw: t.crew ? 1 : 0, ...cr(t) })),
    pm: game.remotePrompt || '',
    dlg: game.dialog.netState(),
    kk: game.kakamora.netState(),
    lt: game.zone === 'lalotai' ? game.lalotai.netState() : null,
    tk: game.teka.netState(),
    c2: game.ch2.netState(),
    pr: game.combat.netState(),
    rs: game.rescue.netState(),
    ev: game.netEvents.splice(0),
  };
  if (full) {
    snap.fl = game.flags;
    snap.ht = game.herd.list.filter((t) => t.taken).map((t) => t.i);
    snap.map = game.map.serialize();
  }
  return snap;
}

// ---------------- 참가자 ----------------
export function setupGuest(game, session, onFirstSnap) {
  game.netRole = 'guest';
  game.coop = true;
  game.session = session;
  game.guestCmd = { timer: 0, edges: new Set() };
  game.boat.netDriven = true;
  game.maui.controlledBy = 'local';
  game.moana.controlledBy = 'remote';
  game._leader = game.maui;
  let first = true;
  session.on('data', (msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'full') { game.hud.toast('이미 두 명이 놀고 있는 방이에요.'); return; }
    if (msg.type !== 'snap') return;
    game.lastSnapAt = performance.now();
    guestApply(game, msg, first);
    if (first) { first = false; onFirstSnap(); }
  });
  session.on('close', () => {
    game.hud.toast('모아나와 연결이 끊겼어요. 잠시 뒤 처음 화면으로 돌아가요.');
    setTimeout(() => location.reload(), 4000);
  });
  session.send({ type: 'hello' });
}

function applyZone(game, z) {
  if (game.zone === z) return;
  game.setZone(z);
  game.lalotai.group.visible = z === 'lalotai';
}

function placeBody(game, e, d) {
  const target = new THREE.Vector3(d.p[0], d.p[1], d.p[2]);
  if (d.b && !e.onBoat) { e.onBoat = false; e.placeOnBoat(target); }
  else if (!d.b && e.onBoat) e.setWorld(target);
  else if (!d.b && e.mesh.parent !== game.scene) { game.scene.add(e.mesh); e.pos.copy(target); }
  e.netP = target;
  e.netF = d.f;
  e.state = d.s;
  e.speedNow = d.sp;
  e.mesh.visible = !!d.v;
}

function applyCritter(game, e, d) {
  const chars = { moana: game.moana, maui: game.maui };
  if (d.car) {
    const who = chars[d.car];
    if (e.carrier !== who) {
      if (e.carrier) e.carrier.removeCarried(e);
      e.state = 'idle';
      e.setCarried(who);
      if (!who.carriedList.includes(e)) who.carriedList.push(e);
    }
    e.state = 'carried';
    e.mesh.visible = true;
    return;
  }
  if (e.carrier) { e.carrier.removeCarried(e); e.carrier = null; e.onBoat = false; }
  if (d.s === 'stolen') {
    if (e.mesh.parent !== game.scene) { game.scene.add(e.mesh); e.onBoat = false; }
    e.netP = new THREE.Vector3(d.p[0], d.p[1], d.p[2]);
    e.state = 'stolen';
    e.mesh.visible = true;
    return;
  }
  placeBody(game, e, d);
}

function guestApply(game, s, first) {
  // 시간과 날씨
  if (first || Math.abs(game.time - s.t) > 0.5) game.time = s.t; else game.time += (s.t - game.time) * 0.1;
  game.timeOfDay = s.tod;
  game.wind.yaw = s.wy;
  if (s.fl) Object.assign(game.flags, s.fl, { restoredApplied: game.flags.restoredApplied });
  Object.assign(game.inventory, s.inv);
  if (s.q !== game.quests.index || first) {
    game.quests.index = s.q;
    game.onStageEnter(game.quests.stage, true);
  }
  applyZone(game, s.z);
  game.effects.shake = Math.max(game.effects.shake, s.sh);
  game.boat.netApply(s.boat);
  // 캐릭터
  for (const k of ['moana', 'maui']) {
    const c = game[k], d = s.ch[k];
    placeBody(game, c, d);
    if (c.form !== d.fm) {
      c.form = d.fm;
      c.model.hawk && (c.model.hawk.visible = d.fm === 'hawk');
      c.model.body.visible = d.fm !== 'hawk';
    }
    c.hp = d.hp; c.maxHp = d.mh; c.hunger = d.hu;
    if (c.hasHook !== !!d.hk) c.setHook(!!d.hk);
    c.swing = d.sw; c.climbMoving = !!d.cm; c.running = !!d.rn; c.flapping = !!d.fl; c.invuln = d.iv ? 0.5 : 0;
  }
  applyCritter(game, game.heihei, s.cr.heihei);
  applyCritter(game, game.pua, s.cr.pua);
  // 거북이
  game.netTurtles ||= new Map();
  const seen = new Set();
  for (const d of s.tu) {
    seen.add(d.id);
    let tu = game.netTurtles.get(d.id);
    if (!tu) {
      tu = new Turtle(game, !!d.bb);
      tu.nid = d.id;
      game.netTurtles.set(d.id, tu);
      game.turtles.push(tu);
    }
    tu.crew = !!d.cw;
    applyCritter(game, tu, d);
  }
  for (const [id, tu] of game.netTurtles) {
    if (seen.has(id)) continue;
    game.scene.remove(tu.mesh);
    game.turtles = game.turtles.filter((t) => t !== tu);
    game.netTurtles.delete(id);
  }
  game.boat.tbox.list = game.turtles.filter((t) => t.state === 'inBox');
  // 안고 있는 목록 정리 (머리 위에 쌓기)
  for (const c of game.characters) {
    c.carried = c.carriedList.filter((x) => x.carrier === c);
    c.carrying = c.carried[0] || null;
    c.restack();
  }
  if (s.ht) for (const i of s.ht) { const t = game.herd.list[i]; if (t && !t.taken) game.herd.take(t); }
  if (s.map) game.map.load(s.map);
  game.netPrompt = s.pm;
  game.dialog.netApply(s.dlg);
  game.kakamora.netApply(s.kk);
  if (s.lt) game.lalotai.netApply(s.lt);
  game.teka.netApply(s.tk);
  game.ch2.netApply(s.c2);
  game.netProjectiles = s.pr;
  game.netRescues = s.rs;
  // 순간 이벤트 재생
  for (const e of s.ev || []) {
    const [type, a, b, c, d, n, o] = e;
    if (type === 'fx') game.effects.emit(a, new THREE.Vector3(b, c, d), n, o || undefined);
    else if (type === 'snd') game.audio.play(a);
    else if (type === 'toast') game.hud.toast(a);
    else if (type === 'big') game.showBigText(a, b);
    else if (type === 'flash') game.effects.flash(a || undefined);
  }
}

// 참가자 화면의 한 프레임
export function guestUpdate(game, dt) {
  const input = game.input;
  game.time += dt;
  if (!game.lostHost && performance.now() - (game.lastSnapAt || 0) > 6000) {
    game.lostHost = true;
    game.hud.toast('모아나와 연결이 끊겼어요. 잠시 뒤 처음 화면으로 돌아가요.');
    setTimeout(() => location.reload(), 4000);
  }
  if (input.consume('map')) game.map.toggle();
  if (input.consume('menu')) { if (game.map.open) game.map.toggle(false); else game.toggleMenu(!game.paused); }
  input.consume('switch');
  game.dialog.update(dt, input);
  const blocked = game.dialog.active || game.map.open;
  const cmd = blocked ? emptyCommand() : input.command();
  // 조작 보내기 (버튼은 놓치지 않게 모아서)
  const G = game.guestCmd;
  for (const e of EDGES) if (cmd[e]) G.edges.add(e);
  G.timer += dt;
  if (G.timer >= CMD_RATE) {
    G.timer = 0;
    game.session.send({
      type: 'cmd',
      c: { moveX: r2(cmd.moveX), moveY: r2(cmd.moveY), run: cmd.run, jumpHeld: cmd.jumpHeld, downHeld: cmd.downHeld, camYaw: r2(game.camRig.yaw) },
      e: [...G.edges],
    });
    G.edges.clear();
  }

  game.boat.update(dt, game.time, game);
  const k = 1 - Math.exp(-14 * dt);
  const follow = (e) => {
    if (!e.netP) return;
    if (e.pos.distanceTo(e.netP) > 8) e.pos.copy(e.netP); else e.pos.lerp(e.netP, k);
    if (e.netF !== undefined) e.facing = approachAngle(e.facing, e.netF, dt * 12);
  };
  for (const c of game.characters) {
    follow(c);
    c.animT += dt;
    c.animate(dt);
  }
  for (const c of [...game.critters, ...game.turtles]) {
    if (c.state === 'stolen') { if (c.netP) c.mesh.position.lerp(c.netP, k); c.animateOnly(dt); continue; }
    if (c.state !== 'carried') follow(c);
    c.animateOnly(dt);
  }
  game.herd.update(dt, game.time, game.camera.position);
  const L = game.leader;
  const lp = L.worldPos(new THREE.Vector3());
  const nearHome = game.zone === 'surface' && Math.hypot(game.camera.position.x, game.camera.position.z) < 900;
  game.village.group.visible = nearHome;
  if (nearHome) {
    for (const n of Object.values(game.npcs)) n.update(dt, lp, game.camera.position);
    game.village.update(dt, game.time, game.sky.light);
  } else for (const n of Object.values(game.npcs)) n.mesh.visible = false;
  game.hud.prompt(blocked ? null : game.netPrompt);

  game.locations.update(dt, game.time);
  game.lalotai.netVisual(dt, game.time);
  game.teka.netVisual(dt, game.time);
  game.kakamora.netVisual(dt, game.time);
  game.ch2.netVisual(dt, game.time);
  game.manta.update(dt, game.time);
  game.rescue.netDraw(game.netRescues || []);
  game.combat.netDraw(game.netProjectiles || []);
  game.effects.update(dt);
  updateReefFoam(game, game.time);
  game.updatePresentation(dt, L, lp);
}
