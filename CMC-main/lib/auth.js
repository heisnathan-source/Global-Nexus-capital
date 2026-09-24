import { verifySessionToken, USER_COOKIE_NAME } from "@/lib/session.js";
export function requireRole(request, role) {
  const token = request.cookies.get(USER_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session || session.role !== role) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{"content-type":"application/json"}});
  return null;
}
