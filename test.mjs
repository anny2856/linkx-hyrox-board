import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import app,{initialRaces,validate} from './worker/app.js';
export function database(){const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_dashboard.sql','utf8').replaceAll('--> statement-breakpoint',''));const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}}}});return {prepare:wrap,async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};}
if(process.argv[1].endsWith('test.mjs')){
const env={DB:database(),ADMIN_EMAILS:'admin@example.com'};
const call=(path,method='GET',body,role='anonymous',origin='https://example.test')=>app.fetch(new Request('https://example.test'+path,{method,headers:{...(role==='anonymous'?{}:{'oai-authenticated-user-id':'verified-user','oai-authenticated-user-email':role==='admin'?'admin@example.com':'other@example.com'}),Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
assert.equal((await call('/api/races')).status,200);
assert.equal((await call('/api/initialize','POST',{},'anonymous')).status,401);
assert.equal((await call('/api/initialize','POST',{},'other')).status,403);
assert.equal((await call('/api/initialize','POST',{},'admin','https://evil.test')).status,403);
assert.equal((await call('/api/initialize','POST',{},'admin')).status,200);
assert.equal((await call('/api/initialize','POST',{},'admin')).status,409);
assert.throws(()=>validate({...initialRaces[0],day:'2027-02-30'}));
assert.equal((await call('/api/races','POST',{...initialRaces[0],time:'25:00'},'admin')).status,400);
assert.equal((await call('/api/races/entry-01','PUT',{...initialRaces[0],status:'racing'},'admin')).status,200);
assert.equal((await call('/api/races/entry-01','PUT',{...initialRaces[0],status:'waiting'},'admin')).status,409);
assert.equal((await call('/api/races')).status,200);let data=await (await call('/api/races')).json();assert.equal(data.races.find(r=>r.id==='entry-01').status,'racing');
assert.equal((await call('/api/races','POST',{...initialRaces[0],names:'실제 테스트 선수',sample:0},'admin')).status,201);
data=await (await call('/api/races')).json();const added=data.races.find(r=>r.names==='실제 테스트 선수');assert.equal((await call('/api/races/'+added.id,'DELETE',{version:1},'admin')).status,200);
const stream=await call('/api/events');const reader=stream.body.getReader();const chunk=await reader.read();assert.match(new TextDecoder().decode(chunk.value),/^data: /);await reader.cancel();
for(const race of (await (await call('/api/races')).json()).races)assert.equal((await call('/api/races/'+race.id,'DELETE',{version:race.version},'admin')).status,200);
data=await (await call('/api/races')).json();assert.equal(data.races.length,0);assert.equal(data.samplePreview,false);
console.log('PASS: anonymous read, protected writes, role checks, origin, validation, roster initialization, persistence, concurrency, CRUD, SSE, empty state');
}
