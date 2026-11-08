"""Serve dist/ on :8000. CORS + no-store so the kiosk app can poll version.json."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ThreadingHTTPServer(("", 8000), functools.partial(H, directory="dist")).serve_forever()
