"""Create local secrets without overwriting an existing .env. No credentials printed."""
from pathlib import Path
import secrets
p=Path('.env')
if not p.exists():
    p.write_text('JWT_SECRET='+secrets.token_urlsafe(48)+'\nPOSTGRES_PASSWORD='+secrets.token_hex(24)+'\nADMIN_USERNAME=admin\nADMIN_PASSWORD='+secrets.token_urlsafe(24)+'\nCORS_ORIGINS=http://localhost:4173,http://localhost:5173\n')
    p.chmod(0o600)
    print('Created .env. Open it locally to see the initial administrator password.')
else: print('Preserved existing .env.')
