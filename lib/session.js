import crypto from "crypto";

const USER_COOKIE_NAME = "cmc_user_session";
const ADMIN_COOKIE_NAME = "cmc_admin_session";
const VERIFICATION_COOKIE_NAME = "cmc_verification_session";

export function createSessionToken(userId, role) {
  const secret = process.env.CMC_SESSION_SECRET;

  if (!secret) {
    throw new Error("CMC_SESSION_SECRET is not configured.");
  }

  const payload = Buffer.from(
    JSON.stringify({
      userId,
      role,
      exp: Date.now() + 1000 * 60 * 60 * 24
    })
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  const secret = process.env.CMC_SESSION_SECRET;

  if (!secret || !token) {
    return null;
  }

  const [payload, sig] = token.split(".");

  if (!payload || !sig) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expected)
    )
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (Date.now() > data.exp) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export {
  USER_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  VERIFICATION_COOKIE_NAME
};
