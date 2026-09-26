import fs from 'fs';
import path from 'path';

const root=process.cwd();
const files=[];
function walk(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(e.name==='node_modules'||e.name==='.next') continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory()) walk(p); else if(/\.(js|mjs|jsx|sql)$/.test(e.name)) files.push(p);
 }
}
walk(root);
const required=[
 'app/page.jsx','app/rank/page.jsx','app/withdrawal/page.jsx','app/deposit/page.jsx',
 'app/fund-products/page.jsx','app/tasks/page.jsx','app/team-expansion/page.jsx','app/mine/page.jsx',
 'app/admin/page.jsx','app/admin/financial-records/page.jsx','app/admin/withdrawals/page.jsx'
];
for(const f of required) if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing required page: ${f}`);
const schema=fs.readFileSync(path.join(root,'db/schema.sql'),'utf8');
for(const needle of ['wallet_ledger','withdrawal_orders','fund_purchases','rank_earnings','direct_referrals','messages','support_requests']){
 if(!schema.includes(needle)) throw new Error(`Schema missing ${needle}`);
}
for(const f of files.filter(x=>x.endsWith('.js')||x.endsWith('.mjs'))){
 // Lightweight structural checks; JSX is validated by the Next build.
 const t=fs.readFileSync(f,'utf8');
 if((t.match(/\{/g)||[]).length !== (t.match(/\}/g)||[]).length) throw new Error(`Unbalanced braces: ${f}`);
}
console.log(`Global Nexus Capital integration validation passed: ${files.length} source files inspected.`);
