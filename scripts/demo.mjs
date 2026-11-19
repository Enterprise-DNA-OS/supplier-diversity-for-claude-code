import {getDb} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {seed} from './seed.mjs';
import {run,human} from './diversity.mjs';
const db=await getDb();try{if(db.mode==='postgres')throw Error('Demo uses local PGlite only. Unset DATABASE_URL.');await migrate(db);await seed(db);for(const cmd of ['participation','cert-expiry','attention']){console.log('\n'+cmd+'\n'+human(await run(db,[cmd])));}}finally{await db.close();}
