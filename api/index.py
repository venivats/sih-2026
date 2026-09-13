"""Vercel ASGI entrypoint. No seed, migration or local persistence on invocation."""
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

def configuration_gaps(env):
    gaps=[]
    if not env.get('DATABASE_URL','').startswith(('postgresql://','postgres://','postgresql+psycopg://')):
        gaps.append('managed PostgreSQL DATABASE_URL')
    if len(env.get('JWT_SECRET','')) < 32:
        gaps.append('JWT_SECRET with at least 32 characters')
    if not env.get('S3_BUCKET'):
        gaps.append('private durable S3_BUCKET and provider credentials')
    return gaps

gaps=configuration_gaps(os.environ)
if gaps and os.getenv('VERCEL'):
    app=FastAPI(title='POLARIS · activation required')
    @app.api_route('/{path:path}',methods=['GET','POST','PATCH','PUT','DELETE'])
    def activation_required(path:str,request:Request):
        return JSONResponse(status_code=503,content={'detail':'Backend activation required: configure PostgreSQL, signing secret and private object storage; run migrations before use.','status':'configuration_required'},headers={'Cache-Control':'no-store'})
else:
    from backend.main import app
