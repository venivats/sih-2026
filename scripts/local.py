"""Local Python entrypoint with .env loading; run from the repository root."""
import os,sys,subprocess
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key,value=line.split('=',1);os.environ.setdefault(key,value)
cmd=sys.argv[1:]
raise SystemExit(subprocess.call([sys.executable,*cmd]))
