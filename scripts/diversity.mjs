#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table,price} from './lib/format.mjs';
import {specs,required,date,resolve,addRecord,event,transaction} from './lib/records.mjs';
import {importB2Gnow} from './lib/import-b2gnow.mjs';
import {page,table as htmlTable} from './lib/render.mjs';
export const reads={
 suppliers:'SELECT * FROM suppliers ORDER BY name,id',
 programmes:'SELECT * FROM programmes ORDER BY name,id',
 certificates:'SELECT c.*,s.name supplier FROM certificates c JOIN suppliers s ON s.id=c.supplier_id ORDER BY valid_to,c.id',
 'cert-expiry':"SELECT s.name supplier,c.scheme,c.valid_to,c.issuer FROM certificates c JOIN suppliers s ON s.id=c.supplier_id WHERE c.valid_to<=CURRENT_DATE+30 ORDER BY valid_to,c.id",
 commitments:'SELECT c.*,p.name programme,p.currency,s.name supplier FROM commitments c JOIN programmes p ON p.id=c.programme_id JOIN suppliers s ON s.id=c.supplier_id ORDER BY p.name,s.name,c.id',
 spend:'SELECT * FROM spend_evidence ORDER BY paid_date,id',
 participation:'SELECT programme,currency,total_paid_cents,evidence_covered_cents,evidence_share_pct,goal_bps,committed_cents FROM participation_review ORDER BY programme',
 exceptions:'SELECT programme,supplier,external_id,in_period,has_dated_evidence FROM spend_evidence WHERE NOT in_period OR NOT has_dated_evidence ORDER BY external_id',
 actions:'SELECT a.*,p.name programme FROM actions a JOIN programmes p ON p.id=a.programme_id ORDER BY due,a.id',
 attention:'SELECT * FROM attention_review ORDER BY due,kind,detail',
 compliance:'SELECT * FROM compliance_findings ORDER BY rule,record,finding',
 history:'SELECT * FROM activity ORDER BY created_at,id',
 imports:'SELECT * FROM import_batches ORDER BY created_at,id'
};
export const verbs=[...Object.keys(reads),'supplier','add-supplier','add-programme','record-certificate','record-commitment','record-spend','review-supplier','add-action','close-action','log','import','export','draft-review','help'];
export function parse(args){const positional=[],flags={};for(const x of args){if(x.startsWith('--')){const i=x.indexOf('=');const k=x.slice(2,i<0?undefined:i);if(Object.hasOwn(flags,k))throw Error(`Repeated flag ${k}`);flags[k]=i<0?true:x.slice(i+1);}else positional.push(x);}return {verb:positional.shift()||'help',positional,flags};}
const common=['json'];
function checkFlags(f,allowed){for(const k of Object.keys(f))if(![...common,...allowed].includes(k))throw Error(`Unknown flag --${k}`);}
export async function run(db,args){
 const {verb,positional,flags:f}=parse(args);if(!verbs.includes(verb))throw Error(`Unknown command ${verb}`);
 if(positional.length&&(verb!=='import'||positional.length!==1))throw Error('Unexpected positional arguments');
 if(reads[verb]){checkFlags(f,[]);return db.query(reads[verb]);}
 if(verb==='help'){checkFlags(f,[]);return verbs.map(command=>({command,usage:usage(command)}));}
 if(verb==='supplier'){checkFlags(f,['supplier']);const id=await resolve(db,'suppliers',f.supplier);return {supplier:(await db.query('SELECT * FROM suppliers WHERE id=$1',[id]))[0],certificates:await db.query('SELECT * FROM certificates WHERE supplier_id=$1 ORDER BY valid_to',[id])};}
 if(verb==='import'){checkFlags(f,['manifest','actor','dry-run']);if(positional[0]!=='b2gnow')throw Error('Use import b2gnow');if(f['dry-run']!==undefined&&f['dry-run']!==true)throw Error('--dry-run is a switch');return importB2Gnow(db,required(f.manifest,'manifest'),f.actor,Boolean(f['dry-run']));}
 if(verb==='export'){
  checkFlags(f,['file']);const file=path.resolve(required(f.file,'file'));const output={version:1,exported_at:new Date().toISOString()};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const kind of [...Object.keys(specs),'actions','notes','import_batches','activity'])output[kind]=await db.query(`SELECT * FROM ${kind} ORDER BY id`);}finally{await db.exec('ROLLBACK');}
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});return {file,record_types:9};
 }
 if(verb==='draft-review'){
  checkFlags(f,['programme','file']);const id=await resolve(db,'programmes',f.programme);const name=required(f.file,'file');if(!/^[a-zA-Z0-9][\w-]*\.html$/.test(name))throw Error('file must be a simple .html filename');
  const sections=[];await db.exec('BEGIN READ ONLY');try{for(const [title,sql]of [['Participation evidence','SELECT * FROM participation_review WHERE programme_id=$1'],['Exceptions','SELECT supplier,external_id,in_period,has_dated_evidence FROM spend_evidence WHERE programme_id=$1 AND (NOT in_period OR NOT has_dated_evidence)'],['Actions','SELECT title,owner,due,state FROM actions WHERE programme_id=$1']])sections.push({title,html:htmlTable(await db.query(sql,[id]))});}finally{await db.exec('ROLLBACK');}
  const out=path.join(REPO_ROOT,'drafts',name);fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});fs.writeFileSync(out,page({title:'Supplier programme review',subtitle:'Private draft. Recorded evidence share is not statutory participation credit.',sections}),{flag:'wx',mode:0o600});return {file:out};
 }
 const kinds={'add-supplier':'suppliers','add-programme':'programmes','record-certificate':'certificates','record-commitment':'commitments','record-spend':'spend'};
 if(kinds[verb]){
  const kind=kinds[verb],names=specs[kind].fields.map(k=>k==='supplier_id'?'supplier':k==='programme_id'?'programme':k.replaceAll('_','-'));checkFlags(f,[...names,'source','actor','currency']);required(f.actor,'actor');
  return transaction(db,async()=>{const row={};for(const k of specs[kind].fields)row[k]=k==='supplier_id'?await resolve(db,'suppliers',f.supplier):k==='programme_id'?await resolve(db,'programmes',f.programme):f[k.replaceAll('_','-')];
   if(['spend','commitments'].includes(kind)){const [p]=await db.query('SELECT currency FROM programmes WHERE id=$1',[row.programme_id]);if(required(f.currency,'currency')!==p.currency)throw Error('currency does not match programme');}
   const result=await addRecord(db,kind,f.source,row);if(result.added)await event(db,f.actor,verb,result);return result;});
 }
 if(verb==='review-supplier'){
  checkFlags(f,['supplier','review-due','retention-review-due','evidence','actor']);required(f.actor,'actor');required(f.evidence,'evidence');const review=date(f['review-due'],'review-due'),retention=date(f['retention-review-due'],'retention-review-due');
  return transaction(db,async()=>{const id=await resolve(db,'suppliers',f.supplier);await db.query('UPDATE suppliers SET review_due=$1,retention_review_due=$2 WHERE id=$3',[review,retention,id]);await event(db,f.actor,verb,{id,review,retention,evidence:f.evidence});return {id};});
 }
 if(verb==='add-action'){
  checkFlags(f,['programme','title','owner','due','actor']);required(f.actor,'actor');required(f.title,'title');required(f.owner,'owner');date(f.due,'due');
  return transaction(db,async()=>{const id=await resolve(db,'programmes',f.programme);const [a]=await db.query('INSERT INTO actions(programme_id,title,owner,due) VALUES($1,$2,$3,$4) RETURNING id',[id,f.title,f.owner,f.due]);await event(db,f.actor,verb,a);return a;});
 }
 if(verb==='close-action'){
  checkFlags(f,['action','evidence','actor']);required(f.actor,'actor');required(f.evidence,'evidence');return transaction(db,async()=>{const id=await resolve(db,'actions',f.action);const rows=await db.query("UPDATE actions SET state='closed',closure_evidence=$1 WHERE id=$2 AND state='open' RETURNING id",[f.evidence,id]);if(!rows.length)throw Error('Action already closed');await event(db,f.actor,verb,{id,evidence:f.evidence});return {id};});
 }
 if(verb==='log'){
  checkFlags(f,['programme','body','actor']);required(f.actor,'actor');required(f.body,'body');return transaction(db,async()=>{const id=await resolve(db,'programmes',f.programme);const [n]=await db.query('INSERT INTO notes(programme_id,actor,body) VALUES($1,$2,$3) RETURNING id',[id,f.actor,f.body]);await event(db,f.actor,verb,n);return n;});
 }
}
export function usage(v){
 const kind={'add-supplier':'suppliers','add-programme':'programmes','record-certificate':'certificates','record-commitment':'commitments','record-spend':'spend'}[v];
 if(kind)return specs[kind].fields.map(k=>'--'+(k==='supplier_id'?'supplier':k==='programme_id'?'programme':k.replaceAll('_','-'))+'=VALUE').join(' ')+' --source=INSTANCE --actor=NAME'+(['spend','commitments'].includes(kind)?' --currency=NZD':'');
 return ({supplier:'--supplier=NAME-OR-ID',import:'b2gnow --manifest=PATH --actor=NAME [--dry-run]',export:'--file=NEW-PATH','draft-review':'--programme=NAME-OR-ID --file=NEW-NAME.html','review-supplier':'--supplier=REF --review-due=YYYY-MM-DD --retention-review-due=YYYY-MM-DD --evidence=TEXT --actor=NAME','add-action':'--programme=REF --title=TEXT --owner=NAME --due=YYYY-MM-DD --actor=NAME','close-action':'--action=REF --evidence=TEXT --actor=NAME',log:'--programme=REF --body=TEXT --actor=NAME'})[v]||'[--json]';
}
export function human(value){if(Array.isArray(value))return value.length?table(value,Object.keys(value[0]).map(key=>({key,label:key.replace(/_cents$/, '').replace(/_bps$/, ' %').replaceAll('_',' '),format:(v,row)=>v===null?'unknown':key.endsWith('_cents')?price(v,row.currency||'NZD'):key.endsWith('_bps')?(Number(v)/100).toFixed(2):typeof v==='object'?JSON.stringify(v):v}))):'(none)';return JSON.stringify(value,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):human(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
