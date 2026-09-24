import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db.js";
import {
  createSessionToken,
  USER_COOKIE_NAME,
} from "@/lib/session.js";

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").replace(/\s/g, "");
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");
  const referralCode = String(body.referralCode || "")
    .trim()
    .toUpperCase();

  if (!name) {
    return Response.json(
      { error: "Full name is required." },
      { status: 400 }
    );
  }

  if (!phone) {
    return Response.json(
      { error: "Phone number is required." },
      { status: 400 }
    );
  }

  if (!password) {
    return Response.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return Response.json(
      { error: "Passwords do not match." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  /*
   * Referral code is mandatory.
   */
  if (!referralCode) {
    return Response.json(
      { error: "Referral code is required." },
      { status: 400 }
    );
  }

  const db = getDb();

  try {
    /*
     * Make sure the phone number is not already registered.
     */
    const existingUser = await db.query(
      `
      SELECT id
      FROM users
      WHERE phone = $1
      LIMIT 1
      `,
      [phone]
    );

    if (existingUser.rowCount) {
      return Response.json(
        {
          error:
            "An account already exists for this phone number.",
        },
        { status: 409 }
      );
    }

    /*
     * The referral code must belong to an enabled,
     * normal user account.
     */
    const sponsor = await db.query(
      `
      SELECT
        rc.user_id
      FROM referral_codes rc
      JOIN users u
        ON u.id = rc.user_id
      WHERE
        UPPER(rc.code) = UPPER($1)
        AND u.role = 'user'
        AND u.enabled = TRUE
      LIMIT 1
      `,
      [referralCode]
    );

    if (!sponsor.rowCount) {
      return Response.json(
        { error: "Invalid referral code." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      /*
       * Re-check the phone number inside the transaction
       * to prevent duplicate registrations.
       */
      const duplicateCheck = await client.query(
        `
        SELECT id
        FROM users
        WHERE phone = $1
        LIMIT 1
        `,
        [phone]
      );

      if (duplicateCheck.rowCount) {
        await client.query("ROLLBACK");

        return Response.json(
          {
            error:
              "An account already exists for this phone number.",
          },
          { status: 409 }
        );
      }

      /*
       * Re-check the referral code inside the transaction.
       *
       * The sponsor account must still be:
       *   - an existing user
       *   - role = user
       *   - enabled
       *
       * Lock the sponsor row so its account status cannot
       * change while this registration is being completed.
       */
      const referralCheck = await client.query(
        `
        SELECT
          rc.user_id
        FROM referral_codes rc
        JOIN users u
          ON u.id = rc.user_id
        WHERE
          UPPER(rc.code) = UPPER($1)
          AND u.role = 'user'
          AND u.enabled = TRUE
        LIMIT 1
        FOR UPDATE OF u
        `,
        [referralCode]
      );

      if (!referralCheck.rowCount) {
        await client.query("ROLLBACK");

        return Response.json(
          { error: "Invalid referral code." },
          { status: 400 }
        );
      }

      const verifiedSponsorId =
        referralCheck.rows[0].user_id;

      /*
       * Create the user.
       */
      const userResult = await client.query(
        `
        INSERT INTO users
          (
            name,
            phone,
            login_password_hash
          )
        VALUES
          (
            $1,
            $2,
            $3
          )
        RETURNING id
        `,
        [
          name,
          phone,
          passwordHash,
        ]
      );

      const userId = userResult.rows[0].id;

      /*
       * Generate this user's own referral code.
       */
      const newReferralCode =
        `CMC${String(userId)
          .replace(/-/g, "")
          .slice(0, 10)
          .toUpperCase()}`;

      await client.query(
        `
        INSERT INTO referral_codes
          (
            user_id,
            code
          )
        VALUES
          (
            $1,
            $2
          )
        `,
        [
          userId,
          newReferralCode,
        ]
      );

      /*
       * Record the direct referral relationship.
       *
       * The sponsor was already verified inside the
       * transaction as an enabled normal user.
       */
      if (
        String(verifiedSponsorId) !==
        String(userId)
      ) {
        await client.query(
          `
          INSERT INTO direct_referrals
            (
              sponsor_user_id,
              referred_user_id,
              referral_code
            )
          VALUES
            (
              $1,
              $2,
              $3
            )
          `,
          [
            verifiedSponsorId,
            userId,
            referralCode,
          ]
        );
      }

      /*
       * Create the user's wallet.
       */
      await client.query(
        `
        INSERT INTO wallets
          (
            user_id
          )
        VALUES
          (
            $1
          )
        `,
        [userId]
      );

      await client.query("COMMIT");

      /*
       * Automatically log the new user in.
       */
      const token = createSessionToken(
        userId,
        "user"
      );

      return new Response(
        JSON.stringify({
          ok: true,
          referralCode: newReferralCode,
        }),
        {
          status: 201,
          headers: {
            "content-type":
              "application/json",
            "set-cookie":
              `${USER_COOKIE_NAME}=${token}; ` +
              `HttpOnly; ` +
              `${
                process.env.NODE_ENV ===
                "production"
                  ? "Secure; "
                  : ""
              }` +
              `SameSite=Lax; ` +
              `Path=/; ` +
              `Max-Age=86400`,
          },
        }
      );
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to create your account.",
      },
      { status: 500 }
    );
  }
}
