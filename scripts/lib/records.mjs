export const specs={
 suppliers:{fields:['external_id','name','owner','review_due','retention_review_due','source_ref'],dates:['review_due','retention_review_due']},
 programmes:{fields:['external_id','name','owner','currency','scheme','goal_bps','start_date','end_date','report_due','source_ref'],dates:['start_date','end_date','report_due'],ints:['goal_bps']},
 certificates:{fields:['external_id','supplier_id','scheme','issuer','valid_from','valid_to','reviewed_by','evidence_ref'],dates:['valid_from','valid_to']},
 commitments:{fields:['external_id','programme_id','supplier_id','amount_cents','source_ref'],ints:['amount_cents']},
 spend:{fields:['external_id','programme_id','supplier_id','paid_date','amount_cents','evidence_ref'],dates:['paid_date'],ints:['amount_cents']}
};
export function required(v,name){if(typeof v!=='string'||!v.trim()||v.length>4000)throw Error(`${name} requires nonempty text (up to 4000 characters)`);return v.trim();}
export function date(v,name){required(v,name);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`${name} must be a real YYYY-MM-DD date`);return v;}
export function integer(v,name,min=0,max=1000000000000){if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)throw Error(`${name} must be an integer between ${min} and ${max}`);return Number(v);}
export function clean(kind,row){
 const s=specs[kind];if(!s)throw Error(`Unknown record type ${kind}`);
 const out={}; for(const f of s.fields){out[f]=(s.ints||[]).includes(f)?integer(row[f],f,f==='amount_cents'?1:0,f==='goal_bps'?10000:1000000000000):(s.dates||[]).includes(f)?date(row[f],f):required(row[f],f);}
 if(out.currency&&!/^[A-Z]{3}$/.test(out.currency))throw Error('currency requires an uppercase three-letter code');
 if(out.end_date&&out.end_date<out.start_date)throw Error('end_date precedes start_date');
 if(out.valid_to&&out.valid_to<out.valid_from)throw Error('valid_to precedes valid_from');
 return out;
}
export async function resolve(db,kind,ref){
 if(!['suppliers','programmes','actions'].includes(kind))throw Error('Unsupported lookup');required(ref,'reference');
 const name=kind==='actions'?'title':'name';
 const rows=await db.query(`SELECT id,${name} name FROM ${kind} WHERE lower(${name})=lower($1) OR starts_with(id::text,lower($1)) ORDER BY id`,[ref]);
 if(rows.length!==1)throw Error(`${rows.length?'Ambiguous':'Unknown'} ${kind}: ${ref}\n`+rows.map(r=>`${r.id} ${r.name}`).join('\n'));
 return rows[0].id;
}
export async function addRecord(db,kind,source,row){
 required(source,'source');const v=clean(kind,row),cols=['source',...Object.keys(v)],vals=[source,...Object.values(v)];
 const prior=await db.query(`SELECT * FROM ${kind} WHERE source=$1 AND external_id=$2`,[source,v.external_id]);
 if(prior.length){if(Object.entries(v).some(([k,x])=>String(prior[0][k])!==String(x)))throw Error(`Conflicting ${kind} ${v.external_id}; evidence was not overwritten`);return {id:prior[0].id,added:false};}
 const [r]=await db.query(`INSERT INTO ${kind} (${cols.join(',')}) VALUES (${vals.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,vals);return {...r,added:true};
}
export async function event(db,actor,verb,detail){required(actor,'actor');await db.query('INSERT INTO activity(actor,verb,detail) VALUES($1,$2,$3)',[actor,verb,JSON.stringify(detail)]);}
export async function transaction(db,fn,dry=false){await db.exec('BEGIN');try{const r=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
