import bcrypt from 'bcryptjs';
import pg from 'pg';
const {Pool}=pg;
const phone=process.env.CMC_ADMIN_PHONE;
const password=process.env.CMC_ADMIN_PASSWORD;
const name=process.env.CMC_ADMIN_NAME||'Global Nexus Capital Administrator';
if(!phone||!password){console.error('Set CMC_ADMIN_PHONE and CMC_ADMIN_PASSWORD first.');process.exit(1)}
if(password.length<12){console.error('Admin password must be at least 12 characters.');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});
try{const hash=await bcrypt.hash(password,12);const r=await pool.query(`INSERT INTO users(name,phone,login_password_hash,role) VALUES($1,$2,$3,'admin') ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,login_password_hash=EXCLUDED.login_password_hash,role='admin' RETURNING id,phone,role`,[name,phone.replace(/\s/g,''),hash]);console.log(`Admin ready: ${r.rows[0].phone} (${r.rows[0].role})`)}finally{await pool.end()}
