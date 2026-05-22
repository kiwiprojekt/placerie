#!/usr/bin/env python3
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_request(self, code='-', size='-'):
        # Only log errors (4xx, 5xx), suppress successful requests
        if isinstance(code, int) and code >= 400:
            super().log_request(code, size)

port = int(sys.argv[1]) if len(sys.argv) > 1 else 7823
http.server.test(HandlerClass=NoCacheHandler, port=port)
