"""Bound request memory and rate-limit expensive unauthenticated endpoints.
Single-process limiter: use one worker or add gateway limits before scaling.
"""
import os,time
from collections import defaultdict,deque
from fastapi.responses import JSONResponse

class RequestGuards:
    def __init__(self,app):self.app=app;self.windows=defaultdict(deque)
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        route=scope['path'];client=(scope.get('client') or ('unknown',))[0]
        if os.getenv('APP_ENV')!='test' and route in ['/api/auth/token','/api/demo-sessions']:
            key=(client,route);queue=self.windows[key];clock=time.monotonic()
            while queue and queue[0]<clock-60:queue.popleft()
            limit=5 if route.endswith('token') else 3
            if len(queue)>=limit:return await JSONResponse({'detail':'Too many attempts; retry in one minute'},status_code=429,headers={'Retry-After':'60'})(scope,receive,send)
            queue.append(clock)
            if len(self.windows)>10000:
                self.windows={k:v for k,v in self.windows.items() if v and v[-1]>clock-60}
                self.windows=defaultdict(deque,self.windows)
        if scope['method'] in ['POST','PATCH','PUT']:
            chunks=[];size=0
            while True:
                msg=await receive()
                if msg['type']=='http.disconnect':return
                chunk=msg.get('body',b'');size+=len(chunk)
                if size>2_200_000:return await JSONResponse({'detail':'Maximum request size is 2 MB'},status_code=413)(scope,receive,send)
                chunks.append(chunk)
                if not msg.get('more_body'):break
            body=b''.join(chunks);sent=False
            async def bounded_receive():
                nonlocal sent
                if not sent:sent=True;return {'type':'http.request','body':body,'more_body':False}
                return await receive()
            return await self.app(scope,bounded_receive,send)
        await self.app(scope,receive,send)
