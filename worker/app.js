const HTML=/*HTML*/null;
export const divisions=["MEN OPEN SINGLE","DOUBLES MEN OPEN","DOUBLES WOMEN OPEN","DOUBLES MIXED","DOUBLES WOMEN PRO","DOUBLES MEN PRO","MEN PRO SINGLE","RELAY WOMEN"];
import {roster} from '../data/roster.js';
export const initialRaces=roster;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
export function identity(req,env){const id=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');return {signedIn:!!id,email:email||null,admin:!!id&&!!email&&(env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())};}
export function validate(r){if(!r||typeof r.names!=='string'||!r.names.trim()||r.names.length>100||!divisions.includes(r.division)||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!Number.isFinite(Date.parse(r.day))||new Date(r.day+'T00:00:00Z').toISOString().slice(0,10)!==r.day||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)||!['waiting','racing','finished'].includes(r.status)||typeof r.lane!=='string'||r.lane.length>60||![0,1].includes(r.sample))throw new Error('이름·날짜·시간·종목을 확인해 주세요.');return {...r,names:r.names.trim()};}
async function snapshot(db){if(!await db.prepare("SELECT value FROM settings WHERE key='initialized'").first())return {races:initialRaces,samplePreview:true};return {races:(await db.prepare('SELECT * FROM races ORDER BY day,time,names').all()).results,samplePreview:false};}
export default {async fetch(req,env){try{const url=new URL(req.url),p=url.pathname,user=identity(req,env);
 if(p==='/api/me')return json(user);
 if(p==='/api/races'&&req.method==='GET')return json(await snapshot(env.DB));
 if(p==='/api/events'&&req.method==='GET'){
  let stopped=false,timer,previous='';const encoder=new TextEncoder();
  const stream=new ReadableStream({start(controller){let count=0;const tick=async()=>{try{if(stopped)return;const data=JSON.stringify(await snapshot(env.DB));if(stopped)return;controller.enqueue(encoder.encode(data!==previous?'data: '+data+'\n\n':': heartbeat\n\n'));previous=data;if(++count>=25){stopped=true;controller.close();return;}timer=setTimeout(tick,2000);}catch{if(!stopped){stopped=true;controller.error(new Error('stream unavailable'));}}};tick();},cancel(){stopped=true;clearTimeout(timer);}});
  return new Response(stream,{headers:{...headers,'Content-Type':'text/event-stream'}});
 }
 if(p.startsWith('/api/')){
  if(!user.admin)return json({error:user.signedIn?'관리자 계정만 수정할 수 있습니다.':'관리자 로그인이 필요합니다.'},user.signedIn?403:401);
  if(!['POST','PUT','DELETE'].includes(req.method))return json({error:'지원하지 않는 요청'},405);
  if(req.headers.get('Origin')!==url.origin)return json({error:'잘못된 요청 출처'},403);
  const at=new Date().toISOString(),audit=(action,id)=>env.DB.prepare('INSERT INTO audit(actor,action,race_id,at) VALUES(?,?,?,?)').bind(user.email,action,id,at);
  if(p==='/api/initialize'&&req.method==='POST'){
   if(await env.DB.prepare("SELECT value FROM settings WHERE key='initialized'").first())return json({error:'이미 초기화되었습니다.'},409);
   const statements=[env.DB.prepare("INSERT INTO settings(key,value) VALUES('initialized','1')")];
   statements.push(...initialRaces.map(r=>env.DB.prepare('INSERT OR IGNORE INTO races(id,names,division,day,time,lane,status,sample,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(r.id,r.names,r.division,r.day,r.time,r.lane,r.status,r.sample,1,at)));
   statements.push(audit('initialize','all'));await env.DB.batch(statements);return json(await snapshot(env.DB));
  }
  const match=p.match(/^\/api\/races\/([a-zA-Z0-9-]+)$/);
  if(p!=='/api/races'&&!match)return json({error:'찾을 수 없습니다.'},404);
  if(!await env.DB.prepare("SELECT value FROM settings WHERE key='initialized'").first())return json({error:'먼저 명단 저장 및 관리 시작을 눌러주세요.'},409);
  if(Number(req.headers.get('content-length')||0)>8192)return json({error:'입력 크기 초과'},413);
  const raw=await req.text();if(raw.length>8192)return json({error:'입력 크기 초과'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'입력 형식 오류'},400);}
  if(p==='/api/races'&&req.method==='POST'){let r;try{r=validate(body);}catch(e){return json({error:e.message},400);}const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO races(id,names,division,day,time,lane,status,sample,version,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?)').bind(id,r.names,r.division,r.day,r.time,r.lane,r.status,r.sample,at),audit('create',id)]);return json({ok:true},201);}
  if(!match)return json({error:'지원하지 않는 요청'},405);
  const id=match[1];if(!Number.isInteger(body.version)||body.version<1)return json({error:'변경 버전이 필요합니다.'},400);
  let statement;
  if(req.method==='DELETE')statement=env.DB.prepare('DELETE FROM races WHERE id=? AND version=?').bind(id,body.version);
  else if(req.method==='PUT'){let r;try{r=validate(body);}catch(e){return json({error:e.message},400);}statement=env.DB.prepare('UPDATE races SET names=?,division=?,day=?,time=?,lane=?,status=?,sample=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(r.names,r.division,r.day,r.time,r.lane,r.status,r.sample,at,id,body.version);}
  else return json({error:'지원하지 않는 요청'},405);
  const result=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(actor,action,race_id,at) SELECT ?,?,?,? WHERE changes()>0').bind(user.email,req.method,id,at)]);
  if(!result[0].meta.changes)return json({error:'다른 관리자가 변경했습니다. 새 내용을 확인하고 다시 시도해 주세요.'},409);return json({ok:true});
 }
 if(p!=='/')return new Response('Not found',{status:404});
 return new Response(HTML,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});
 }catch(e){console.error('Dashboard request failed',e.message);return json({error:'연결을 확인한 뒤 다시 시도해 주세요.'},503);}}};
