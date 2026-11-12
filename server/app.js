import {roster} from '../data/roster.js';
const allowedDivisions=['MEN OPEN SINGLE','DOUBLES MEN OPEN','DOUBLES WOMEN OPEN','DOUBLES MIXED','DOUBLES WOMEN PRO','DOUBLES MEN PRO','MEN PRO SINGLE','RELAY WOMEN'];
const baseFields='id,names,division,day,time,lane,status,sample,version,updated_at';
const fields=baseFields+',finish_time';
const noCache={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...noCache,...extra}});
const configured=env=>!!(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY&&env.SUPABASE_SERVICE_ROLE_KEY&&env.ADMIN_EMAILS);
const isAdmin=(email,env)=>!!email&&(env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
function cookies(req){return Object.fromEntries((req.headers.get('cookie')||'').split(';').map(v=>v.trim().split(/=(.*)/s).slice(0,2)).filter(v=>v.length===2));}
function setSession(response,tokens,secure=true){for(const [name,value,age] of [['linkx_access',tokens?.access_token||'',tokens?Math.min(tokens.expires_in||3600,3600):0],['linkx_refresh',tokens?.refresh_token||'',tokens?604800:0]])response.headers.append('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`);return response;}
async function supa(env,path,{method='GET',body,token,service=false}={},fetcher=fetch){const key=service?env.SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_ANON_KEY;const res=await fetcher(env.SUPABASE_URL.replace(/\/$/,'').trim()+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});let data=null;try{data=await res.json();}catch{}if(!res.ok){const e=new Error('Supabase request failed');e.status=res.status;e.missingFinishTime=['42703','PGRST204'].includes(data?.code)&&String(data?.message||'').includes('finish_time');throw e;}return data;}
export function validFinishTime(value){return value===null||(typeof value==='string'&&/^\d{2}:[0-5]\d:[0-5]\d$/.test(value)&&value!=='00:00:00');}
export function validate(r){if(!r||typeof r.names!=='string'||!r.names.trim()||r.names.length>100||!allowedDivisions.includes(r.division)||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!Number.isFinite(Date.parse(r.day))||new Date(r.day+'T00:00:00Z').toISOString().slice(0,10)!==r.day||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)||!['waiting','racing','finished'].includes(r.status)||typeof r.lane!=='string'||r.lane.length>60||![0,1].includes(r.sample))throw new Error('Invalid race fields');return Object.fromEntries(['names','division','day','time','lane','status','sample'].map(k=>[k,k==='names'?r.names.trim():r[k]]));}
async function readBody(req){const text=await req.text();if(text.length>8192)throw new Error('body too large');return JSON.parse(text);}
async function user(req,env,fetcher){const c=cookies(req);if(!c.linkx_access)return null;try{return await supa(env,'/auth/v1/user',{token:decodeURIComponent(c.linkx_access)},fetcher);}catch(e){if(e.status===401||e.status===403)return null;throw e;}}
async function snapshot(env,fetcher){let races,resultEnabled=true;try{races=await supa(env,'/rest/v1/hyrox_races?select='+fields+'&order=day.asc,time.asc,names.asc',{service:true},fetcher);}catch(error){if(!error.missingFinishTime)throw error;resultEnabled=false;races=await supa(env,'/rest/v1/hyrox_races?select='+baseFields+'&order=day.asc,time.asc,names.asc',{service:true},fetcher);}return {races:races.map(r=>({...r,time:r.time.slice(0,5),finish_time:r.finish_time||null})),samplePreview:false,configured:true,resultEnabled};}
export async function handler(req,env,fetcher=fetch){const url=new URL(req.url),path=url.pathname;const secure=url.protocol==='https:';try{
 if(req.method==='GET'&&path==='/api/races')return reply(configured(env)?await snapshot(env,fetcher):{races:roster,samplePreview:false,configured:false});
 if(!configured(env)){if(path==='/api/me')return reply({signedIn:false,admin:false,email:null,setupRequired:true});return reply({error:'관리자 로그인과 저장은 Supabase 연결 후 사용할 수 있습니다.'},503);}
 if(['POST','PUT','DELETE'].includes(req.method)&&req.headers.get('origin')!==url.origin)return reply({error:'잘못된 요청 출처입니다.'},403);
 if(path==='/api/login'&&req.method==='POST'){
  let data;try{data=await readBody(req);}catch{return reply({error:'입력 형식을 확인해 주세요.'},400);}
  if(typeof data.email!=='string'||typeof data.password!=='string'||!isAdmin(data.email,env)||data.password.length>256)return reply({error:'관리자 이메일 또는 비밀번호를 확인해 주세요.'},401);
  try{const tokens=await supa(env,'/auth/v1/token?grant_type=password',{method:'POST',body:{email:data.email.trim(),password:data.password}},fetcher);if(!tokens.user?.id||!isAdmin(tokens.user.email,env))return reply({error:'관리자 권한이 없습니다.'},403);return setSession(reply({ok:true}),tokens,secure);}catch(e){if([400,401,403].includes(e.status))return reply({error:'관리자 이메일 또는 비밀번호를 확인해 주세요.'},401);if(e.status===429)return reply({error:'로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.'},429);throw e;}
 }
 if(path==='/api/logout'&&req.method==='POST'){const c=cookies(req);if(c.linkx_access)try{await supa(env,'/auth/v1/logout',{method:'POST',token:decodeURIComponent(c.linkx_access)},fetcher);}catch{}return setSession(reply({ok:true}),null,secure);}
 if(path==='/api/me'&&req.method==='GET'){
  let person=await user(req,env,fetcher),tokens;const c=cookies(req);
  if(!person&&c.linkx_refresh){try{tokens=await supa(env,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:decodeURIComponent(c.linkx_refresh)}},fetcher);person=tokens.user;}catch(e){if(![400,401,403].includes(e.status))throw e;}}
  const response=reply({signedIn:!!person?.id,admin:!!person?.id&&isAdmin(person.email,env),email:person?.email||null,setupRequired:false});if(tokens)return setSession(response,tokens,secure);if(!person&&c.linkx_refresh)return setSession(response,null,secure);return response;
 }
 if(path==='/api/events'&&req.method==='GET'){
  let stopped=false,timer,last='';const encoder=new TextEncoder();
  const stream=new ReadableStream({start(controller){let count=0;const tick=async()=>{try{if(stopped)return;const data=JSON.stringify(await snapshot(env,fetcher));if(stopped)return;controller.enqueue(encoder.encode(data!==last?'data: '+data+'\n\n':': heartbeat\n\n'));last=data;if(++count>=20){stopped=true;controller.close();return;}timer=setTimeout(tick,2000);}catch{if(!stopped){stopped=true;controller.error(new Error('Connection lost'));}}};tick();},cancel(){stopped=true;clearTimeout(timer);}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
 }
 if(!['POST','PUT','DELETE'].includes(req.method))return reply({error:'찾을 수 없습니다.'},404);
 const person=await user(req,env,fetcher);if(!person?.id)return reply({error:'관리자 로그인이 필요합니다.'},401);if(!isAdmin(person.email,env))return reply({error:'관리자만 수정할 수 있습니다.'},403);
 let data;try{data=await readBody(req);}catch{return reply({error:'입력 형식 또는 크기를 확인해 주세요.'},400);}
 const resultMatch=path.match(/^\/api\/races\/([a-zA-Z0-9-]{1,80})\/result$/);
 if(resultMatch){
  if(req.method!=='PUT')return reply({error:'지원하지 않는 요청입니다.'},405);
  if(!Number.isSafeInteger(data.version)||data.version<1||!validFinishTime(data.finish_time))return reply({error:'완주 기록을 01:23:45처럼 시:분:초로 입력해 주세요. 00:00:00은 사용할 수 없습니다.'},400);
  try{const changed=await supa(env,'/rest/v1/hyrox_races?id=eq.'+encodeURIComponent(resultMatch[1])+'&version=eq.'+data.version+'&status=eq.finished',{method:'PATCH',service:true,body:{finish_time:data.finish_time,updated_by:person.email}},fetcher);
   if(!changed?.length)return reply({error:'완주 상태의 최신 일정에만 기록을 저장할 수 있습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'},409);
   return reply({ok:true});
  }catch(error){if(error.missingFinishTime)return reply({error:'기록 저장 설정이 필요합니다. 운영자가 Supabase에 기록 추가 SQL을 적용해 주세요.'},503);throw error;}
 }
 if(path==='/api/races'&&req.method==='POST'){let row;try{row=validate(data);}catch{return reply({error:'선수 이름·종목·날짜·시간을 확인해 주세요.'},400);}await supa(env,'/rest/v1/hyrox_races',{method:'POST',service:true,body:{...row,id:crypto.randomUUID(),updated_by:person.email}},fetcher);return reply({ok:true},201);}
 const match=path.match(/^\/api\/races\/([a-zA-Z0-9-]{1,80})$/);if(!match)return reply({error:'찾을 수 없습니다.'},404);if(!['PUT','DELETE'].includes(req.method))return reply({error:'지원하지 않는 요청입니다.'},405);if(!Number.isSafeInteger(data.version)||data.version<1)return reply({error:'수정 버전이 필요합니다.'},400);
 let row;if(req.method==='PUT'){try{row=validate(data);}catch{return reply({error:'선수 이름·종목·날짜·시간을 확인해 주세요.'},400);}}
 const changed=await supa(env,'/rest/v1/hyrox_races?id=eq.'+encodeURIComponent(match[1])+'&version=eq.'+data.version,{method:req.method==='PUT'?'PATCH':'DELETE',service:true,body:row?{...row,updated_by:person.email}:undefined},fetcher);
 if(!changed?.length)return reply({error:'다른 관리자가 변경했습니다. 최신 내용을 확인하고 다시 시도해 주세요.'},409);return reply({ok:true});
 }catch{ return reply({error:'서버 연결을 확인해 주세요. Supabase 설정과 SQL 적용 여부를 확인해야 합니다.'},503);}}
