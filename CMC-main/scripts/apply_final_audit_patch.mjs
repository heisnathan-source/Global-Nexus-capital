import fs from "fs";
import path from "path";
import pg from "pg";

function loadDotEnv(){
  for(const file of [".env.local",".env"]){
    const full=path.join(process.cwd(),file);
    if(!fs.existsSync(full)) continue;
    for(const line of fs.readFileSync(full,"utf8").split(/\r?\n/)){
      const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if(!m||process.env[m[1]]) continue;
      let v=m[2].trim();
      if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
      process.env[m[1]]=v;
    }
  }
}
loadDotEnv();

if(!process.env.DATABASE_URL){
  console.error("DATABASE_URL is not configured. Add it to .env or export it before running this script.");
  process.exit(1);
}

const sql=fs.readFileSync(path.join(process.cwd(),"db","patch_2026_08_24_final_audit.sql"),"utf8");
const pool=new pg.Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==="false"?false:{rejectUnauthorized:false}
});

try{
  await pool.query(sql);
  console.log("Global Nexus Capital final audit database patch applied successfully.");
}catch(error){
  console.error("Global Nexus Capital final audit database patch failed:");
  console.error(error.message);
  process.exitCode=1;
}finally{
  await pool.end();
}
