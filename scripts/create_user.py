"""Run locally or in the app container; prompts privately for a password."""
import argparse,getpass
from sqlalchemy import select
from backend.database import SessionLocal
from backend.models import User
from backend.modules.access import passwords
p=argparse.ArgumentParser();p.add_argument('username');p.add_argument('--role',choices=['viewer','operator','administrator'],default='viewer');a=p.parse_args()
password=getpass.getpass('New user password (12+ characters): ')
if len(password)<12:raise SystemExit('Password too short')
with SessionLocal() as db:
    if db.scalar(select(User).where(User.username==a.username)):raise SystemExit('User already exists; no changes made')
    db.add(User(username=a.username,password_hash=passwords.hash(password),role=a.role));db.commit()
print('Account created.')
