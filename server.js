/**
 * 자리바꾸기 PWA & 기록 저장 서버 (Node.js 내장 모듈만 사용 - 별도 npm install 불필요!)
 * 실행 방법: node server.js
 * 기본 포트: http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SYNC_API_KEY || ''; // 필요 시 비밀번호 설정
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sanitizeRoom(room) {
  return String(room || 'default-class').replace(/[^a-zA-Z0-9가-힣_-]/g, '_').slice(0, 80) || 'default-class';
}

function checkAuth(req) {
  if (!API_KEY) return true;
  const headerKey = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return headerKey === API_KEY;
}

const server = http.createServer((req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // REST API: /api/sync/:room 또는 /api/sync?room=...
  if (pathname.startsWith('/api/sync')) {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '보안 키(비밀번호)가 일치하지 않습니다.' }));
    }

    const parts = pathname.replace(/^\/api\/sync\/?/, '').split('/');
    const room = sanitizeRoom(parts[0] || parsedUrl.searchParams.get('room') || 'default-class');
    const filePath = path.join(DATA_DIR, `${room}.json`);

    if (req.method === 'GET') {
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: '저장된 기록이 없습니다.', room }));
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(raw);
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 25 * 1024 * 1024) req.destroy(); // 25MB 제한 (학생 사진 포함 고려)
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const record = {
            ...parsed,
            roomKey: room,
            serverSavedAt: Date.now()
          };
          fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, room, savedAt: record.serverSavedAt }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '올바른 JSON 형식이 아닙니다.' }));
        }
      });
      return;
    }
  }

  // 정적 파일 서빙 (PWA)
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, path.normalize(safePath).replace(/^(\.\.[\/\\])+/, ''));

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` 🚀 우리반 자리바꾸기 PWA & 기록 서버가 실행되었습니다!`);
  console.log(` 👉 접속 주소: http://localhost:${PORT}`);
  console.log(` 💾 데이터 저장 폴더: ${DATA_DIR}`);
  console.log(`====================================================`);
});
