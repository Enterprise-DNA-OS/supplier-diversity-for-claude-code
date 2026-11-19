import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCsv} from './csv.mjs';
import {specs,required,integer,clean,addRecord,event,transaction} from './records.mjs';
// B2Gnow reports have configurable columns. The manifest maps actual exported
// headers explicitly; no guessed vendor header names or silently invented values.
export async function importB2Gnow(db,manifestPath,actor,dry=false){
 required(actor,'actor');const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));const source=required(m.source,'source instance'),sourceRef=required(m.source_ref,'source_ref');
 if(!Array.isArray(m.files)||!m.files.length)throw Error('Manifest needs files');
 const order=Object.keys(specs);let last=-1;const seen=new Set();let total=0;
 const files=m.files.map(f=>{
  if(!specs[f.kind]||order.indexOf(f.kind)<last)throw Error('Files must be suppliers, programmes, certificates, commitments, spend in dependency order');last=order.indexOf(f.kind);
  if(!f.columns||typeof f.columns!=='object')throw Error('Explicit columns mapping required');
  const expected=specs[f.kind].fields.map(k=>k==='supplier_id'?'supplier_external_id':k==='programme_id'?'programme_external_id':k);
  if(['spend','commitments'].includes(f.kind))expected.push('currency');
  if(Object.keys(f.columns).some(k=>!expected.includes(k))||expected.some(k=>!f.columns[k]))throw Error(`Mapping must cover exactly: ${expected.join(', ')}`);
  const raw=fs.readFileSync(path.resolve(path.dirname(manifestPath),required(f.path,'path')),'utf8');const rows=parseCsv(raw);
  if(rows.length!==integer(f.expected_count,'expected_count',0,1000000))throw Error(`Count mismatch for ${f.path}`);
  const mapped=rows.map((row,i)=>{const o={};for(const [k,col]of Object.entries(f.columns)){if(!Object.hasOwn(row,col))throw Error(`Missing exported column ${col}`);o[k]=required(row[col],`${f.path} row ${i+2} ${col}`);}const key=f.kind+'\0'+o.external_id;if(seen.has(key))throw Error(`Duplicate ${f.kind} ID ${o.external_id}`);seen.add(key);return o;});total+=rows.length;
  return {kind:f.kind,rows:mapped,hash:createHash('sha256').update(raw).digest('hex'),expected_count:rows.length};
 });
 const fingerprint=createHash('sha256').update(JSON.stringify({source,sourceRef,files})).digest('hex');
 const prior=await db.query('SELECT id,row_count FROM import_batches WHERE fingerprint=$1',[fingerprint]);
 if(prior.length)return {batch:prior[0].id,added:0,skipped:total,replayed:true,dry_run:dry};
 return transaction(db,async()=>{
  let added=0,skipped=0;
  for(const f of files)for(const original of f.rows){
   const row={...original};
   for(const [ref,kind]of [['supplier','suppliers'],['programme','programmes']])if(row[ref+'_external_id']){
    const matches=await db.query(`SELECT id FROM ${kind} WHERE source=$1 AND external_id=$2`,[source,row[ref+'_external_id']]);if(matches.length!==1)throw Error(`Unresolved ${ref} ${row[ref+'_external_id']} in source ${source}`);row[ref+'_id']=matches[0].id;delete row[ref+'_external_id'];
   }
   if(['spend','commitments'].includes(f.kind)){const [p]=await db.query('SELECT currency FROM programmes WHERE id=$1',[row.programme_id]);if(row.currency!==p.currency)throw Error('Imported currency does not match programme');delete row.currency;}
   const result=await addRecord(db,f.kind,source,clean(f.kind,row));result.added?added++:skipped++;
  }
  const scope=files.map(f=>({kind:f.kind,rows:f.expected_count,sha256:f.hash}));
  const [batch]=await db.query('INSERT INTO import_batches(source,fingerprint,source_ref,actor,row_count,added,skipped,scope) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[source,fingerprint,sourceRef,actor,total,added,skipped,JSON.stringify(scope)]);
  await event(db,actor,'import',{batch:batch.id,source,added,skipped});return {batch:batch.id,added,skipped,dry_run:dry};
 },dry);
}
