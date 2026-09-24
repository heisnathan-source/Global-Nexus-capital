import { NextResponse } from "next/server";
import { VERIFICATION_COOKIE_NAME } from "@/lib/session.js";

export async function POST() {
  const response = NextResponse.json({
    success: true,
  });

  response.headers.append(
    "Set-Cookie",
    `${VERIFICATION_COOKIE_NAME}=; HttpOnly${
      process.env.NODE_ENV === "production"
        ? "; Secure"
        : ""
    }; SameSite=Lax; Path=/; Max-Age=0`
  );

  return response;
}
