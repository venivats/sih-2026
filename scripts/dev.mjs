import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
const win=process.platform==='win32';
if(!existsSync('.env')){console.error('Run python scripts/setup.py first.');process.exit(1)}
for(const line of readFileSync('.env','utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>0&&!line.startsWith('#'))process.env[line.slice(0,i)]??=line.slice(i+1)}
const python=win?'.venv/Scripts/python.exe':'.venv/bin/python';
const commands=[[python,['-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000']],['node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4173',...process.argv.slice(2)]]];
const children=commands.map(([cmd,args])=>spawn(cmd,args,{stdio:'inherit',env:process.env}));
for(const child of children)child.on('error',e=>console.error(e.message));
process.on('SIGINT',()=>{for(const child of children)child.kill('SIGTERM');process.exit()});
console.log('Keep this terminal open. Frontend: http://localhost:4173 · API: http://localhost:8000/docs');
