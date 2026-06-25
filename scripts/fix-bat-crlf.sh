#!/bin/bash
# Force CRLF + ASCII-safe .bat for Windows cmd.exe
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 file.bat [file2.bat ...]"
  exit 1
fi

python3 - "$@" <<'PY'
import sys
from pathlib import Path

for arg in sys.argv[1:]:
    p = Path(arg)
    text = p.read_text(encoding="utf-8")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u2014", "-").replace("\u2013", "-")
    out = text.replace("\n", "\r\n")
    if not out.endswith("\r\n"):
        out += "\r\n"
    p.write_bytes(out.encode("ascii", errors="replace"))
    print(f"    CRLF: {p.name}")
PY
