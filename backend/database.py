import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

DATABASE_URL = (os.getenv('DATABASE_URL') or 'sqlite:///./polaris.db')
# Managed hosts commonly supply the generic PostgreSQL URL; use the pinned psycopg driver.
if DATABASE_URL.startswith(('postgresql://', 'postgres://')):
    DATABASE_URL = 'postgresql+psycopg://' + DATABASE_URL.split('://', 1)[1]
options = {'connect_args': {'check_same_thread': False}} if DATABASE_URL.startswith('sqlite') else {}
# Avoid idle connection multiplication across serverless instances; use the provider pooler.
if os.getenv('VERCEL') and not DATABASE_URL.startswith('sqlite'):
    options.update(poolclass=NullPool, connect_args={'connect_timeout': 10})
engine = create_engine(DATABASE_URL, pool_pre_ping=True, **options)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase):
    pass

def db_session():
    with SessionLocal() as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
