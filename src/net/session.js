// 2인 플레이 연결: 브라우저끼리 직접(WebRTC, PeerJS)
// - 방을 만든 사람(모아나)이 "주인": 게임 전체를 계산하고 상태를 보낸다
// - 참가한 사람(마우이)은 조작만 보내고, 받은 상태를 화면에 그린다
// 처음 서로를 찾을 때만 PeerJS 공개 서버(0.peerjs.com)를 쓴다.
// 주소 뒤에 ?peer=호스트:포트 를 붙이면 직접 띄운 PeerJS 서버를 쓴다.

const PREFIX = 'moana-voyage-v1-';

function loadPeerJS() {
  if (window.peerjs) return Promise.resolve(window.peerjs);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/peerjs.min.js';
    s.onload = () => resolve(window.peerjs);
    s.onerror = () => reject(new Error('연결 도구를 불러오지 못했어요'));
    document.head.appendChild(s);
  });
}

function peerOptions() {
  const q = new URLSearchParams(location.search).get('peer');
  const opts = { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };
  if (!q) return opts;
  const [host, port] = q.split(':');
  return { ...opts, host, port: Number(port) || 9000, path: '/', secure: false, config: { iceServers: [] } };
}

function openPeer(Peer, id) {
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const onErr = (e) => { p.off('open'); reject(e); };
    p.once('error', onErr);
    p.once('open', () => { p.off('error', onErr); resolve(p); });
  });
}

export function koreanError(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return '그 방 번호를 찾을 수 없어요. 번호를 다시 확인해 주세요.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return '인터넷 연결을 확인해 주세요. (연결 도우미 서버에 닿지 않아요)';
  if (t === 'browser-incompatible') return '이 브라우저는 2인 플레이를 지원하지 않아요.';
  if (e && e.message === 'timeout') return '연결 시간이 초과됐어요. 두 기기가 인터넷에 연결되어 있는지 확인해 주세요.';
  return `연결에 실패했어요 (${t || (e && e.message) || '알 수 없음'})`;
}

export class NetSession {
  constructor() {
    this.role = null;
    this.peer = null;
    this.conn = null;
    this.code = null;
    this.handlers = {};
  }

  on(ev, f) { this.handlers[ev] = f; }
  emit(ev, d) { if (this.handlers[ev]) this.handlers[ev](d); }
  get connected() { return !!(this.conn && this.conn.open); }

  async host() {
    const { Peer } = await loadPeerJS();
    for (let tries = 0; tries < 6 && !this.peer; tries++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      try {
        this.peer = await openPeer(Peer, PREFIX + code);
        this.code = code;
      } catch (e) {
        if (e.type !== 'unavailable-id') throw e;
      }
    }
    if (!this.peer) throw new Error('방 번호를 만들지 못했어요');
    this.role = 'host';
    this.peer.on('connection', (conn) => {
      // 예전 연결이 조용히 끊겼으면(창을 그냥 닫은 경우) 새 연결로 바꾼다
      if (this.connected && this.isStale && this.isStale()) this.dropConnection();
      if (this.connected) {
        // 이미 마우이가 있으면 정중히 거절
        conn.on('open', () => { conn.send({ type: 'full' }); setTimeout(() => conn.close(), 500); });
        return;
      }
      this.attach(conn);
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch { /* 무시 */ } });
    this.peer.on('error', (e) => this.emit('error', e));
    return this.code;
  }

  async join(code) {
    const { Peer } = await loadPeerJS();
    this.peer = await openPeer(Peer, null);
    this.role = 'guest';
    this.code = code;
    await new Promise((resolve, reject) => {
      const conn = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const to = setTimeout(() => reject(new Error('timeout')), 20000);
      conn.on('open', () => { clearTimeout(to); this.attach(conn); resolve(); });
      this.peer.on('error', (e) => { clearTimeout(to); reject(e); });
    });
  }

  attach(conn) {
    this.conn = conn;
    conn.on('data', (d) => this.emit('data', d));
    conn.on('close', () => { if (this.conn !== conn) return; this.conn = null; this.emit('close'); });
    conn.on('error', (e) => this.emit('error', e));
    if (conn.open) this.emit('open');
    else conn.on('open', () => this.emit('open'));
  }

  // 응답이 없는 연결을 끊고 'close'를 알린다
  dropConnection() {
    const c = this.conn;
    this.conn = null;
    try { if (c) c.close(); } catch { /* 무시 */ }
    this.emit('close');
  }

  send(msg) {
    if (!this.connected) return;
    try { this.conn.send(msg); } catch { /* 연결이 끊기는 중 */ }
  }

  close() {
    try { if (this.conn) this.conn.close(); } catch { /* 무시 */ }
    try { if (this.peer) this.peer.destroy(); } catch { /* 무시 */ }
  }
}
