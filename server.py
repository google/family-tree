#!/usr/bin/env python3
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Development HTTP server for Family Tree application."""

import http.server
import os
import socket
import socketserver
import sys

DEFAULT_PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class DevHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Disable caching during active development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.jsx'):
            return 'text/javascript; charset=utf-8'
        return super().guess_type(path)

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def find_available_port(start_port=DEFAULT_PORT, max_attempts=10):
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('0.0.0.0', p)) != 0:
                return p
    return start_port

def run_server(port=None):
    if port is None:
        port = int(sys.argv[1]) if len(sys.argv) > 1 else find_available_port()

    host = '0.0.0.0'
    server_address = (host, port)
    
    with ReusableTCPServer(server_address, DevHTTPRequestHandler) as httpd:
        hostname = socket.gethostname()
        print(f"Family Tree Development Server started on port {port}")
        print(f"Local URL:    http://localhost:{port}/")
        print(f"Network URL:  http://{hostname}:{port}/")
        print(f"Serving directory: {DIRECTORY}")
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run_server()
