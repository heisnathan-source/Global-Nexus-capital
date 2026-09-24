import {
  USER_COOKIE_NAME,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

export async function POST() {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie":
          `${USER_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0, ` +
          `${ADMIN_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
      }
    }
  );
}
