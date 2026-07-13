#!/usr/bin/env python3
"""Dev server for CluColor.

Serves the project over http (ES modules will not load from file://), and
accepts POSTs to /__report from the test pages so browser test results show up
in this terminal instead of only on screen.

    python3 tools/serve.py            # http://localhost:8000
    python3 tools/serve.py --port 9000

Also prints the LAN address, for checking on an Android phone.
"""

from __future__ import annotations

import argparse
import base64
import json
import socket
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / ".shots"  # gitignored; scratch output for canvas captures

GREEN = "\033[32m"
RED = "\033[31m"
DIM = "\033[2m"
BOLD = "\033[1m"
OFF = "\033[0m"


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802  (stdlib naming)
        if self.path not in ("/__report", "/__shot"):
            self.send_error(404)
            return

        length = int(self.headers.get("content-length") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_error(400)
            return

        if self.path == "/__report":
            self._print_report(payload)
        else:
            self._save_shots(payload)

        self.send_response(204)
        self.end_headers()

    @staticmethod
    def _save_shots(payload: dict) -> None:
        """Canvas captures POSTed by tools/shots.html, as data: URLs."""
        SHOTS.mkdir(parents=True, exist_ok=True)
        for shot in payload.get("shots", []):
            name = "".join(c for c in shot["name"] if c.isalnum() or c in "-_")
            _, _, b64 = shot["png"].partition(",")
            (SHOTS / f"{name}.png").write_bytes(base64.b64decode(b64))
            print(f"  {DIM}shot{OFF} {SHOTS / name}.png")
        sys.stdout.flush()

    @staticmethod
    def _print_report(payload: dict) -> None:
        results = payload.get("results") or []
        failed = [r for r in results if not r.get("ok")]
        suite = payload.get("suite", "?")

        engine = "unknown"
        ua = payload.get("ua", "")
        if "Chrome" in ua or "Chromium" in ua:
            engine = "Blink"
        elif "Safari" in ua:
            engine = "WebKit"
        elif "Firefox" in ua:
            engine = "Gecko"

        head = f"{BOLD}{suite}{OFF} {DIM}({engine}){OFF}"
        if failed:
            print(f"\n{head}  {RED}{len(failed)}/{len(results)} FAILED{OFF}")
            for r in failed:
                print(f"  {RED}x{OFF} {r['name']}")
                if r.get("detail") is not None:
                    print(f"      got: {r['detail']}")
        else:
            print(f"\n{head}  {GREEN}all {len(results)} passed{OFF}")
        sys.stdout.flush()

    def end_headers(self) -> None:
        # Never cache during development — stale modules are a miserable bug.
        self.send_header("cache-control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        # Quiet: only surface errors, not every asset fetch.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            sys.stderr.write(f"{DIM}{self.requestline} -> {status}{OFF}\n")


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no packets sent; just picks the route
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    port = ap.parse_args().port

    handler = partial(Handler, directory=str(ROOT))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)

    print(f"\n  {BOLD}CluColor{OFF} dev server")
    print(f"  game     {BOLD}http://localhost:{port}/{OFF}")
    print(f"  android  {DIM}http://{lan_ip()}:{port}/{OFF}   (same wifi)")
    print(f"  tests    {DIM}http://localhost:{port}/tests/{OFF}\n")
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  bye\n")


if __name__ == "__main__":
    main()
