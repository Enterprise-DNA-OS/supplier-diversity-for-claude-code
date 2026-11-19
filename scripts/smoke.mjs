import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'supplier-diversity-test-'));
process.env.DATA_DIR=path.join(tmp,'db');process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
const {getDb,REPO_ROOT}=await import('./lib/db.mjs');
const {migrate}=await import('./migrate.mjs');const {seed}=await import('./seed.mjs');
const {run,verbs,human}=await import('./diversity.mjs');const {parseCsv}=await import('./lib/csv.mjs');
const db=await getDb();let checks=0;const exercised=new Set();
async function cmd(v,f={},extra=[]){exercised.add(v);return run(db,[v,...extra,...Object.entries(f).map(([k,x])=>x===true?'--'+k:`--${k}=${x}`)]);}
function eq(a,b){assert.deepEqual(a,b);checks++;}
async function reject(fn,re){await assert.rejects(fn,re);checks++;}
const actor='Test operator';let draft;
try{
 if(db.mode==='postgres'){const occupied=await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");assert.equal(occupied.length,0,'TEST_DATABASE_URL must point to a disposable empty database');}
 await migrate(db);eq((await migrate(db)).ran.length,0);await seed(db);await seed(db);eq((await cmd('suppliers')).length,3);
 let p=await cmd('participation');eq(Number(p[0].total_paid_cents),1000000);eq(Number(p[0].evidence_covered_cents),300000);eq(Number(p[0].evidence_share_pct),30);eq(Number(p[0].committed_cents),800000);eq(p[1].currency,'AUD');eq(Number(p[1].total_paid_cents),100000);
 eq((await cmd('exceptions')).length,3);eq((await cmd('cert-expiry')).length,3);eq((await cmd('attention')).length,6);eq((await cmd('compliance')).length,6);
 for(const v of ['programmes','certificates','commitments','spend','actions','history','imports','help'])await cmd(v);
 eq((await cmd('supplier',{supplier:'fictional harbour supplies'})).supplier.external_id,'S1');
 eq((await cmd('supplier',{supplier:'10000000-0000-0000-0000-000000000001'})).certificates.length,2);
 await reject(()=>cmd('supplier',{supplier:'10000000'}),/Ambiguous.*suppliers[\s\S]*Harbour Supplies[\s\S]*Harbour Services/);
 await reject(()=>cmd('supplier',{supplier:"' OR 1=1 --"}),/Unknown suppliers/);
 await reject(()=>cmd('suppliers',{'typo':true}),/Unknown flag/);
 const supplier=await cmd('add-supplier',{'external-id':'S4',name:'<script>bad()</script>',owner:'Test',source:'manual','review-due':'2030-01-01','retention-review-due':'2030-01-02','source-ref':'Test source',actor});
 await reject(()=>cmd('add-supplier',{'external-id':'S5',name:'Bad date',owner:'Test',source:'manual','review-due':'2026-02-30','retention-review-due':'2030-01-02','source-ref':'Test source',actor}),/real YYYY/);
 const programme=await cmd('add-programme',{'external-id':'P3',name:'Test programme',owner:'Test',source:'manual',currency:'NZD',scheme:'Test','goal-bps':'5000','start-date':'2026-01-01','end-date':'2026-12-31','report-due':'2027-01-15','source-ref':'Test',actor});
 eq((await db.query('SELECT evidence_share_pct FROM participation_review WHERE programme_id=$1',[programme.id]))[0].evidence_share_pct,null);
 await cmd('record-certificate',{'external-id':'C4',supplier:supplier.id,scheme:'Test',issuer:'Test office','valid-from':'2026-01-01','valid-to':'2026-12-31','reviewed-by':'Test','evidence-ref':'Test document',source:'manual',actor});
 await cmd('record-commitment',{'external-id':'K4',programme:programme.id,supplier:supplier.id,'amount-cents':'10000',currency:'NZD','source-ref':'Test',source:'manual',actor});
 const spendArgs={'external-id':'E6',programme:programme.id,supplier:supplier.id,'paid-date':'2026-01-01','amount-cents':'12345',currency:'NZD','evidence-ref':'Test',source:'manual',actor};
 eq((await cmd('record-spend',spendArgs)).added,true);eq((await cmd('record-spend',spendArgs)).added,false);
 await reject(()=>cmd('record-spend',{...spendArgs,'amount-cents':'12346'}),/Conflicting/);
 await reject(()=>cmd('record-spend',{...spendArgs,'external-id':'BAD',currency:'AUD'}),/currency/);
 await reject(()=>cmd('record-spend',{...spendArgs,'external-id':'BAD','amount-cents':'-1'}),/integer/);
 await reject(()=>cmd('record-spend',{...spendArgs,'external-id':'BAD','amount-cents':'1.5'}),/integer/);
 await cmd('record-spend',{...spendArgs,'external-id':'E7','paid-date':'2026-12-31'});
 await cmd('record-spend',{...spendArgs,'external-id':'E8','paid-date':'2027-01-01'});
 p=(await db.query('SELECT * FROM participation_review WHERE programme_id=$1',[programme.id]))[0];eq(Number(p.total_paid_cents),24690);eq(Number(p.evidence_covered_cents),24690);
 await cmd('review-supplier',{supplier:supplier.id,'review-due':'2031-01-01','retention-review-due':'2031-02-01',evidence:'Reviewed test record',actor});
 const a=await cmd('add-action',{programme:programme.id,title:'Test follow up',owner:'Test',due:'2027-01-01',actor});
 await reject(()=>cmd('close-action',{action:a.id,evidence:'',actor}),/nonempty/);
 await cmd('close-action',{action:a.id,evidence:'Test done',actor});await reject(()=>cmd('close-action',{action:a.id,evidence:'Again',actor}),/already closed/);
 await cmd('log',{programme:programme.id,body:'Test note',actor});
 await reject(()=>db.query('DELETE FROM spend WHERE external_id=$1',['E6']),/append-only/);
 await reject(()=>db.query('UPDATE certificates SET issuer=$1 WHERE external_id=$2',['New','C4']),/append-only/);
 // A mapped B2Gnow report bundle: all five record types, independent counts,
 // source isolation, exact replay, rollback and changed-evidence refusal.
 const rows={
 suppliers:[{external_id:'S9',name:'Imported supplier',owner:'Test',review_due:'2030-01-01',retention_review_due:'2030-01-02',source_ref:'Export fixture'}],
 programmes:[{external_id:'P9',name:'Imported programme',owner:'Test',currency:'NZD',scheme:'Test',goal_bps:'5000',start_date:'2026-01-01',end_date:'2026-12-31',report_due:'2027-01-15',source_ref:'Export fixture'}],
 certificates:[{external_id:'C9',supplier_external_id:'S9',scheme:'Test',issuer:'Test office',valid_from:'2026-01-01',valid_to:'2026-12-31',reviewed_by:'Test',evidence_ref:'Fixture'}],
 commitments:[{external_id:'K9',programme_external_id:'P9',supplier_external_id:'S9',amount_cents:'50000',source_ref:'Fixture',currency:'NZD'}],
 spend:[{external_id:'E9',programme_external_id:'P9',supplier_external_id:'S9',paid_date:'2026-04-01',amount_cents:'10000',evidence_ref:'Fixture',currency:'NZD'}]
 };
 const m={source:'test-b2gnow-instance',source_ref:'Fictional exported reports, filters and reconciled counts',files:[]};
 for(const [kind,records]of Object.entries(rows)){const keys=Object.keys(records[0]);fs.writeFileSync(path.join(tmp,kind+'.csv'),keys.join(',')+'\n'+records.map(x=>keys.map(k=>x[k]).join(',')).join('\n'));m.files.push({kind,path:kind+'.csv',expected_count:1,columns:Object.fromEntries(keys.map(k=>[k,k]))});}
 const mf=path.join(tmp,'manifest.json');const save=()=>fs.writeFileSync(mf,JSON.stringify(m));save();
 eq((await cmd('import',{manifest:mf,actor,'dry-run':true},['b2gnow'])).added,5);eq((await db.query("SELECT * FROM suppliers WHERE source='test-b2gnow-instance'")).length,0);
 eq((await cmd('import',{manifest:mf,actor},['b2gnow'])).added,5);eq((await cmd('import',{manifest:mf,actor},['b2gnow'])).replayed,true);
 m.source_ref='Second extract same records';save();eq((await cmd('import',{manifest:mf,actor},['b2gnow'])).skipped,5);
 fs.appendFileSync(path.join(tmp,'suppliers.csv'),'\nS10,New supplier,Test,2030-01-01,2030-01-02,Fixture');m.files[0].expected_count=2;
 fs.writeFileSync(path.join(tmp,'spend.csv'),fs.readFileSync(path.join(tmp,'spend.csv'),'utf8').replace('10000','10001'));save();
 await reject(()=>cmd('import',{manifest:mf,actor},['b2gnow']),/Conflicting/);eq((await db.query("SELECT * FROM suppliers WHERE external_id='S10'")).length,0);
 m.files[0].expected_count=1;save();await reject(()=>cmd('import',{manifest:mf,actor},['b2gnow']),/Count mismatch/);
 m.files[0].expected_count=2;m.source='second-instance';save();eq((await cmd('import',{manifest:mf,actor},['b2gnow'])).added,6);
 m.source='third-instance';fs.writeFileSync(path.join(tmp,'spend.csv'),fs.readFileSync(path.join(tmp,'spend.csv'),'utf8').replace('NZD','AUD'));save();await reject(()=>cmd('import',{manifest:mf,actor},['b2gnow']),/currency/);eq((await db.query("SELECT * FROM suppliers WHERE source='third-instance'")).length,0);
 assert.throws(()=>parseCsv('a,a\n1,2'),/unique/);checks++;
 eq(parseCsv('\ufeffid,note\r\n1,"A, B\nC"\r\n')[0].note,'A, B\nC');
 m.files[0].columns.name='Nonexistent column';save();await reject(()=>cmd('import',{manifest:mf,actor},['b2gnow']),/Missing exported column/);
 const out=path.join(tmp,'backup.json');await cmd('export',{file:out});const backup=JSON.parse(fs.readFileSync(out));eq(Object.keys(backup).length,11);eq(backup.suppliers.length,7);await reject(()=>cmd('export',{file:out}),/EEXIST/);
 const draftName='test-'+path.basename(tmp)+'.html';draft=path.join(REPO_ROOT,'drafts',draftName);await cmd('draft-review',{programme:programme.id,file:draftName});assert.ok(fs.readFileSync(draft,'utf8').includes('&lt;script&gt;'));checks++;await reject(()=>cmd('draft-review',{programme:programme.id,file:draftName}),/EEXIST/);await reject(()=>cmd('draft-review',{programme:programme.id,file:'../escape.html'}),/simple/);
 eq([...exercised].sort(),[...verbs].sort());assert.ok(human(await cmd('participation')).includes('NZD'));checks++;
 await db.close();
 const cli=spawnSync(process.execPath,['scripts/diversity.mjs','participation','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(cli.status,0);assert.ok(Array.isArray(JSON.parse(cli.stdout)));checks++;
 const bad=spawnSync(process.execPath,['scripts/diversity.mjs','supplier','--supplier=10000000'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(bad.status,1);assert.match(bad.stderr,/Ambiguous/);checks++;
 for(const script of ['view','docs']){const p=spawnSync(process.execPath,[`scripts/${script}.mjs`],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(p.status,0);}
 const html=fs.readFileSync(path.join(REPO_ROOT,'views/week.html'),'utf8');assert.ok(!html.includes('<script>bad()'));checks++;
 console.log(`PASS: ${checks} assertions; all ${verbs.length} CLI verbs; ${db.mode}; import rollback, currency separation, evidence dates, drafts, export and HTML.`);
}finally{try{await db.close();}catch{}if(draft)fs.rmSync(draft,{force:true});fs.rmSync(tmp,{recursive:true,force:true});}
