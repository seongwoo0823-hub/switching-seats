#!/usr/bin/env node
/**
 * ============================================================================
 * 우리반 자리바꾸기 PWA & 기록 저장 서버 (server.js)
 * - CommonJS / ES Module(type: "module") 모두 완벽 호환 (__dirname 미사용!)
 * - 터미널(명령 프롬프트 / PowerShell)에서 실행하세요:
 *     node server.js
 * ============================================================================
 */
(async () => {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ [안내] server.js는 브라우저 콘솔(F12)이 아니라 터미널(명령 프롬프트)에서 "node server.js"로 실행하는 파일입니다. 브라우저 내에서는 이미 내장 서버가 작동 중입니다!');
    return;
  }

  const http = await import('node:http');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const process = await import('node:process');

  const ROOT_DIR = process.cwd();
  const PORT = Number(process.env.PORT || 3000);
  const API_KEY = String(process.env.SYNC_API_KEY || '');
  const DATA_DIR = path.join(ROOT_DIR, 'data');

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
    const headerKey = req.headers['x-api-key'] || String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    return headerKey === API_KEY;
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // REST API: /api/sync/:room 또는 /api/sync?room=...
    if (pathname.startsWith('/api/sync')) {
      if (!checkAuth(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: '보안 키(비밀번호)가 일치하지 않습니다.' }));
      }

      const parts = pathname.replace(/^\/api\/sync\/?/, '').split('/');
      const room = sanitizeRoom(parts[0] || parsedUrl.searchParams.get('room') || 'default-class');
      const filePath = path.join(DATA_DIR, room + '.json');

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
          if (body.length > 25 * 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const record = Object.assign({}, parsed, {
              roomKey: room,
              serverSavedAt: Date.now()
            });
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
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const relPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
    const fullPath = path.join(ROOT_DIR, relPath);

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
    console.log('====================================================');
    console.log(' 🚀 우리반 자리바꾸기 PWA & 기록 서버가 실행되었습니다!');
    console.log(' 👉 접속 주소: http://localhost:' + PORT);
    console.log(' 💾 데이터 저장 폴더: ' + DATA_DIR);
    console.log('====================================================');
  });
})();
