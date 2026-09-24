import { getDb } from "@/lib/db.js";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";

function adminSession(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="admin"?s:null;
}

export async function GET(request){
 const admin=adminSession(request);
 if(!admin) return Response.json({error:"Unauthorized"},{status:401});
 const db=getDb();
 const q=await db.query("SELECT * FROM content_pages ORDER BY title");
 return Response.json({pages:q.rows});
}

export async function POST(request){
 const admin=adminSession(request);
 if(!admin) return Response.json({error:"Unauthorized"},{status:401});
 const {pageKey,title,content,bannerUrl,active=true}=await request.json();
 if(!pageKey||!title) return Response.json({error:"Page key and title are required."},{status:400});
 const db=getDb();
 const q=await db.query(`
   INSERT INTO content_pages(page_key,title,content,banner_url,active,updated_at)
   VALUES($1,$2,$3,$4,$5,NOW())
   ON CONFLICT(page_key) DO UPDATE SET
     title=EXCLUDED.title,content=EXCLUDED.content,
     banner_url=EXCLUDED.banner_url,active=EXCLUDED.active,updated_at=NOW()
   RETURNING *
 `,[pageKey,title,content||"",bannerUrl||null,active]);
 await db.query(`
   INSERT INTO admin_actions(admin_user_id,action_type,target_type,reason,metadata)
   VALUES($1,'content_updated','content_page',$2,$3)
 `,[admin.userId,title,JSON.stringify({pageKey})]);
 return Response.json({page:q.rows[0]});
}

export async function DELETE(request){
 const admin=adminSession(request);

 if(!admin){
   return Response.json(
     {error:"Unauthorized"},
     {status:401}
   );
 }

 const {searchParams}=new URL(request.url);

 const key=searchParams.get("key");

 if(!key){
   return Response.json(
     {error:"Content key is required."},
     {status:400}
   );
 }

 const db=getDb();

 const q=await db.query(
   `
   DELETE FROM content_pages
   WHERE page_key=$1
   RETURNING *
   `,
   [key]
 );

 if(!q.rowCount){
   return Response.json(
     {error:"Content was not found."},
     {status:404}
   );
 }

 await db.query(
   `
   INSERT INTO admin_actions(
     admin_user_id,
     action_type,
     target_type,
     target_id,
     reason,
     metadata
   )
   VALUES($1,$2,$3,$4,$5,$6)
   `,
   [
     admin.userId,
     "content_deleted",
     "content_page",
     q.rows[0].id || null,
     q.rows[0].title,
     JSON.stringify({pageKey:key})
   ]
 );

 return Response.json({
   success:true,
   page:q.rows[0]
 });
}
