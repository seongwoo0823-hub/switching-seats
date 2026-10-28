#!/usr/bin/env python3
"""
자리바꾸기 PWA & 기록 저장 서버 (Python 3 기본 내장 모듈만 사용 - 별도 pip install 불필요!)
실행 방법: python3 server.py
기본 포트: http://localhost:3000
"""
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = int(os.environ.get("PORT", 3000))
API_KEY = os.environ.get("SYNC_API_KEY", "")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

def sanitize_room(room: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9가-힣_-]", "_", str(room or "default-class"))[:80]
    return cleaned or "default-class"

class SeatShuffleHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
        super().end_headers()

    def _check_auth(self) -> bool:
        if not API_KEY:
            return True
        auth = self.headers.get("X-API-Key") or self.headers.get("Authorization", "").replace("Bearer ", "")
        return auth.strip() == API_KEY

    def _resolve_room(self, parsed) -> str:
        path_tail = unquote(parsed.path).replace("/api/sync", "", 1).strip("/")
        qs = parse_qs(parsed.query)
        room = path_tail.split("/")[0] if path_tail else (qs.get("room", ["default-class"])[0])
        return sanitize_room(room)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/sync"):
            if not self._check_auth():
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "Unauthorized"}).encode("utf-8"))
                return
            room = self._resolve_room(parsed)
            file_path = os.path.join(DATA_DIR, f"{room}.json")
            if not os.path.exists(file_path):
                self.send_response(404)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "Not found", "room": room}).encode("utf-8"))
                return
            with open(file_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/sync"):
            if not self._check_auth():
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "Unauthorized"}).encode("utf-8"))
                return
            room = self._resolve_room(parsed)
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8")
            try:
                payload = json.loads(raw)
                payload["roomKey"] = room
                file_path = os.path.join(DATA_DIR, f"{room}.json")
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "room": room}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    print("====================================================")
    print(" 🚀 우리반 자리바꾸기 PWA & 기록 서버 (Python) 실행 완료!")
    print(f" 👉 접속 주소: http://localhost:{PORT}")
    print(f" 💾 데이터 저장 폴더: {DATA_DIR}")
    print("====================================================")
    ThreadingHTTPServer(("0.0.0.0", PORT), SeatShuffleHandler).serve_forever()
