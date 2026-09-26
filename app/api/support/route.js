import { getDb } from "@/lib/db.js";
import { verifySessionToken, USER_COOKIE_NAME } from "@/lib/session.js";
function session(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${USER_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="user"?s:null;
}
export async function GET(request){
 const s=session(request); if(!s) return Response.json({error:"Unauthorized"},{status:401});
 const db=getDb();
 const q=await db.query(`
   SELECT id,subject,message,status,admin_reply,created_at,updated_at
   FROM support_requests WHERE user_id=$1 ORDER BY created_at DESC
 `,[s.userId]);
 return Response.json({requests:q.rows});
}
export async function POST(request){
 const s=session(request); if(!s) return Response.json({error:"Unauthorized"},{status:401});
 const {subject,message}=await request.json();
 if(!subject?.trim()||!message?.trim())
   return Response.json({error:"Subject and message are required."},{status:400});
 const db=getDb();
 const q=await db.query(`
   INSERT INTO support_requests(user_id,subject,message)
   VALUES($1,$2,$3) RETURNING *
 `,[s.userId,subject.trim(),message.trim()]);
 return Response.json({request:q.rows[0]},{status:201});
}
