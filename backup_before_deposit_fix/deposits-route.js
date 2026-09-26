import { createDepositOrder, submitDepositPayment } from "@/lib/deposit-service.js";
import { verifySessionToken, USER_COOKIE_NAME } from "@/lib/session.js";

function session(request){
 const c=request.headers.get("cookie")||"";
 const m=c.match(new RegExp(`${USER_COOKIE_NAME}=([^;]+)`));
 const s=m?verifySessionToken(m[1]):null;
 return s&&s.role==="user"?s:null;
}

export async function POST(request){
 const s=session(request);
 if(!s) return Response.json({error:"Unauthorized"},{status:401});
 try{
  const body=await request.json();
  if(body.action==="submit"){
   const order=await submitDepositPayment(s.userId,body.orderId);
   return Response.json({order});
  }
  const amountText=String(body.amount ?? "").trim();
  if(!/^\d+(\.\d{1,2})?$/.test(amountText))
   return Response.json({error:"Enter a valid deposit amount."},{status:400});
  return Response.json(await createDepositOrder(s.userId,amountText),{status:201});
 }catch(e){
  return Response.json({error:e.message},{status:400});
 }
}
