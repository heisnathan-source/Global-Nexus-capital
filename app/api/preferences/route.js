import { getDb } from "@/lib/db.js";
import { verifySessionToken, USER_COOKIE_NAME } from "@/lib/session.js";
function session(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${USER_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="user"?s:null;
}
export async function POST(request){
 const s=session(request); if(!s) return Response.json({error:"Unauthorized"},{status:401});
 const {language="English",notificationsEnabled=true}=await request.json();
 const db=getDb();
 const q=await db.query(`
   INSERT INTO user_preferences(user_id,language,notifications_enabled,updated_at)
   VALUES($1,$2,$3,NOW())
   ON CONFLICT(user_id) DO UPDATE SET
     language=EXCLUDED.language,
     notifications_enabled=EXCLUDED.notifications_enabled,
     updated_at=NOW()
   RETURNING *
 `,[s.userId,language,!!notificationsEnabled]);
 return Response.json({preferences:q.rows[0]});
}
