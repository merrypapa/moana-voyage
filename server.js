// 간단한 정적 파일 서버.
// 같은 Wi-Fi의 아이패드에서 접속할 수 있도록 0.0.0.0 에서 대기합니다.
// 나중에 2인 온라인 플레이를 붙일 때 이 서버에 WebSocket 중계를 추가합니다 (docs/GAME_DESIGN.md 참고).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root) || file.includes(`${path.sep}.git`)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`\n🌊 모아나의 항해 서버가 시작되었습니다.`);
  console.log(`   이 컴퓨터:  http://localhost:${port}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`   아이패드:  http://${a.address}:${port}`);
    }
  }
  console.log('');
});
