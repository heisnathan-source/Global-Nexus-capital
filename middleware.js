import { NextResponse } from "next/server";

const USER_COOKIE_NAME = "cmc_user_session";
const ADMIN_COOKIE_NAME = "cmc_admin_session";
const VERIFICATION_COOKIE_NAME =
  "cmc_verification_session";

function readSessionRole(request, cookieName) {
  const token =
    request.cookies.get(cookieName)?.value;

  if (!token) return null;

  const dot = token.indexOf(".");

  if (dot <= 0) return null;

  const payload = token.slice(0, dot);

  try {
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const decoded = atob(normalized);

    const data = JSON.parse(decoded);

    if (
      !data ||
      typeof data !== "object" ||
      typeof data.role !== "string"
    ) {
      return null;
    }

    if (
      typeof data.exp === "number" &&
      Date.now() > data.exp
    ) {
      return null;
    }

    return data.role;
  } catch {
    return null;
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const userRole = readSessionRole(
    request,
    USER_COOKIE_NAME
  );

  const adminRole = readSessionRole(
    request,
    ADMIN_COOKIE_NAME
  );

  const verificationRole =
    readSessionRole(
      request,
      VERIFICATION_COOKIE_NAME
    );

  /*
   * Public authentication pages.
   */
  if (
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname === "/mini-admin/login"
  ) {
    return NextResponse.next();
  }

  /*
   * MINI ADMIN
   *
   * Verification staff takes priority here.
   *
   * This is important when an old admin cookie
   * is still present in the browser.
   */
  if (
    pathname === "/mini-admin" ||
    pathname.startsWith("/mini-admin/")
  ) {
    if (
      verificationRole ===
      "verification_staff"
    ) {
      return NextResponse.next();
    }

    /*
     * Only redirect a genuine admin session when
     * there is no verification-staff session.
     */
    if (adminRole === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = "/mini-admin/login";

    return NextResponse.redirect(url);
  }

  /*
   * MAIN ADMIN
   *
   * Verification staff takes priority here too.
   *
   * If a staff session exists, the person cannot
   * enter the main Admin portal even if an old
   * admin cookie is also present.
   */
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    if (
      verificationRole ===
      "verification_staff"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/mini-admin";
      return NextResponse.redirect(url);
    }

    if (adminRole !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  /*
   * MAIN USER HOME.
   */
  if (pathname === "/") {
    if (userRole !== "user") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/mini-admin/:path*",
    "/login",
    "/admin/login",
    "/mini-admin/login",
  ],
};
