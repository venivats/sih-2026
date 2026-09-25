import os
from datetime import datetime,timedelta,timezone
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from ..database import db_session
from ..models import User, Workspace
from .permissions import ROLE_AREAS, can_write

passwords=PasswordHash.recommended()
oauth=OAuth2PasswordBearer(tokenUrl='/api/auth/token',auto_error=False)
def secret():
    s=os.getenv('JWT_SECRET','')
    if len(s)<32: raise RuntimeError('JWT_SECRET must contain at least 32 characters. Run scripts/setup.py.')
    return s

def token(sub,role,workspace=None):
    return jwt.encode({'sub':sub,'role':role,'workspace':workspace,'iss':'polaris','aud':'polaris-api','exp':datetime.now(timezone.utc)+timedelta(hours=2)},secret(),algorithm='HS256')

def actor(bearer=Depends(oauth),db=Depends(db_session)):
    if not bearer: return {'sub':'public','role':'public'}
    try: claims=jwt.decode(bearer,secret(),algorithms=['HS256'],issuer='polaris',audience='polaris-api')
    except jwt.InvalidTokenError: raise HTTPException(401,'Session expired; sign in again')
    if claims['role']=='demo_operator':
        w=db.get(Workspace,claims.get('workspace'))
        if not w or w.kind!='session': raise HTTPException(401,'Demo session unavailable')
    else:
        u=db.get(User,claims['sub'])
        if not u: raise HTTPException(401,'Account unavailable')
        claims['role']=u.role
    return claims

def authorize(who,workspace,write=False,admin=False,area="telemetry"):
    role=who['role']
    if workspace.startswith('session-'):
        if who.get('workspace')!=workspace: raise HTTPException(403,'This demonstration belongs to another visitor')
    elif workspace=='operational':
        if role not in ROLE_AREAS or role in ('public','demo_operator'): raise HTTPException(403,'Sign in to access operational records')
    elif workspace=='demo':
        if write: raise HTTPException(403,'Start a private demonstration session to make changes')
    else: raise HTTPException(404,'Unknown workspace')
    if write and not can_write(role,area): raise HTTPException(403,'Permission denied for '+area+' changes')
    if admin and role!='administrator': raise HTTPException(403,'Administrator permission required')
