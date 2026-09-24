import { getDb } from "@/lib/db.js";
import { verifySessionToken, USER_COOKIE_NAME } from "@/lib/session.js";

function session(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${USER_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="user"?s:null;
}

export async function GET(request){
 const s=session(request);
 if(!s) return Response.json({error:"Unauthorized"},{status:401});
 const db=getDb();
 const q=await db.query(`
   SELECT m.id,m.title,m.body,m.image_url,m.publish_at,m.created_at,um.read_at
   FROM messages m
   LEFT JOIN user_messages um ON um.message_id=m.id AND um.user_id=$1
   WHERE m.active=TRUE
     AND (m.publish_at IS NULL OR m.publish_at<=NOW())
     AND (m.expires_at IS NULL OR m.expires_at>NOW())
   ORDER BY m.created_at DESC
 `,[s.userId]);
 return Response.json({messages:q.rows});
}

export async function POST(request){
 const s=session(request);
 if(!s) return Response.json({error:"Unauthorized"},{status:401});
 const {messageId}=await request.json();
 if(!messageId) return Response.json({error:"Message id is required."},{status:400});
 const db=getDb();
 const q=await db.query(`
   INSERT INTO user_messages(message_id,user_id,read_at)
   VALUES($1,$2,NOW())
   ON CONFLICT(message_id,user_id) DO UPDATE SET read_at=NOW()
   RETURNING *
 `,[messageId,s.userId]);
 return Response.json({read:q.rows[0]});
}
