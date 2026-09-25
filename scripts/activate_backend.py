"""Explicit release command, run once against the intended deployment database.
Never called at build time or during a web request. Environment must be loaded.
"""
import os
from alembic.config import Config
from alembic import command

def main():
    if not os.getenv('DATABASE_URL','').startswith(('postgresql://','postgres://','postgresql+psycopg://')):
        raise SystemExit('Set the intended managed PostgreSQL DATABASE_URL before activation.')
    if len(os.getenv('JWT_SECRET',''))<32 or len(os.getenv('ADMIN_PASSWORD',''))<12:
        raise SystemExit('Set the signing secret and an initial administrator password before activation.')
    if not os.getenv('S3_BUCKET'):
        raise SystemExit('Configure private durable S3 storage before serverless activation.')
    command.upgrade(Config('alembic.ini'),'head')
    from backend.database import SessionLocal
    from backend.seed import initialize
    with SessionLocal() as db:initialize(db);db.commit()
    print('Migrations and repeatable initialization completed. Existing saved records retained.')
if __name__=='__main__':main()
