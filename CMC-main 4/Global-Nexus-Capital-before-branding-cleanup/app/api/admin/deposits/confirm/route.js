import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/session.js";

function adminSession(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="admin"?s:null;
}

export async function POST(request){
 const s=adminSession(request);
 if(!s) return Response.json({error:"Unauthorized"},{status:401});
 return Response.json({
   error:"This legacy confirmation endpoint is disabled. Use the canonical deposit-order verification endpoint."
 },{status:410});
}
