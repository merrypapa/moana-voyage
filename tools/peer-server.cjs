// (선택) 인터넷 없이 같은 Wi-Fi에서 2인 플레이를 하고 싶을 때 쓰는 연결 도우미 서버
// 사용법: npm install  →  npm run peer-server
// 그다음 두 기기 모두 게임 주소 뒤에 ?peer=<이 컴퓨터 IP>:9000 을 붙여서 접속
const os = require('node:os');
const express = require('express');
const { ExpressPeerServer } = require('peer');

const port = Number(process.env.PEER_PORT) || 9000;
const app = express();
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`\n👫 2인 플레이 연결 도우미가 켜졌어요 (포트 ${port})`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`   게임 주소 뒤에 붙이기:  ?peer=${a.address}:${port}`);
    }
  }
  console.log('');
});
app.use('/', ExpressPeerServer(server, { path: '/' }));
