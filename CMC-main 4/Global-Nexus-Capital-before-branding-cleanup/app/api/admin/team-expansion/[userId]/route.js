import { getDb } from "@/lib/db.js";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME
} from "@/lib/session.js";

function getAdminSession(request) {
  const cookie =
    request.headers.get("cookie") || "";

  const match = cookie.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const session = match
    ? verifySessionToken(match[1])
    : null;

  return session && session.role === "admin"
    ? session
    : null;
}

export async function GET(
  request,
  { params }
) {
  const admin =
    getAdminSession(request);

  if (!admin) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const resolvedParams =
      await params;

    const userId = String(
      resolvedParams?.userId || ""
    ).trim();

    if (!userId) {
      return Response.json(
        {
          error:
            "User ID is required."
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const userResult =
      await db.query(
        `
        SELECT
          u.id,
          u.name,
          u.phone,
          u.account_id,
          u.registration_date,
          u.enabled,
          u.rank_id,

          COALESCE(
            r.name,
            'STARTER'
          ) AS rank_name,

          COALESCE(
            w.available_balance,
            0
          ) AS available_balance,

          COALESCE(
            w.reserved_balance,
            0
          ) AS reserved_balance

        FROM users u

        LEFT JOIN ranks r
          ON r.id = u.rank_id

        LEFT JOIN wallets w
          ON w.user_id = u.id

        WHERE
          u.id = $1
          AND u.role = 'user'

        LIMIT 1
        `,
        [userId]
      );

    if (!userResult.rowCount) {
      return Response.json(
        {
          error:
            "User not found."
        },
        { status: 404 }
      );
    }

    const user =
      userResult.rows[0];

    const referralCodeResult =
      await db.query(
        `
        SELECT code
        FROM referral_codes
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
      );

    const referralCode =
      referralCodeResult.rowCount
        ? referralCodeResult.rows[0].code
        : null;

    const sponsorResult =
      await db.query(
        `
        SELECT
          sponsor.id,
          sponsor.name,
          sponsor.phone,
          sponsor.account_id,

          dr.referral_code,

          dr.created_at
            AS referral_created_at,

          dr.qualifying_status,

          dr.qualified_at

        FROM direct_referrals dr

        JOIN users sponsor
          ON sponsor.id =
             dr.sponsor_user_id

        WHERE
          dr.referred_user_id = $1
          AND sponsor.role = 'user'

        LIMIT 1
        `,
        [userId]
      );

    const sponsor =
      sponsorResult.rowCount
        ? sponsorResult.rows[0]
        : null;

    const referralsResult =
      await db.query(
        `
        SELECT
          referred.id,
          referred.name,
          referred.phone,
          referred.account_id,

          COALESCE(
            r.name,
            'STARTER'
          ) AS rank_name,

          dr.referral_code,

          dr.created_at
            AS referral_created_at,

          dr.qualifying_status,

          dr.qualified_at,

          CASE
            WHEN
              dr.qualifying_status =
                'starter_qualified'
              OR dr.qualified_at
                IS NOT NULL
            THEN TRUE
            ELSE FALSE
          END AS is_qualified

        FROM direct_referrals dr

        JOIN users referred
          ON referred.id =
             dr.referred_user_id

        LEFT JOIN ranks r
          ON r.id =
             referred.rank_id

        WHERE
          dr.sponsor_user_id = $1
          AND referred.role = 'user'

        ORDER BY
          dr.created_at DESC
        `,
        [userId]
      );

    const referralChainResult =
      await db.query(
        `
        WITH RECURSIVE referral_chain AS (

          SELECT
            u.id,
            u.name,
            u.phone,
            u.account_id,

            dr.sponsor_user_id,

            0 AS depth

          FROM users u

          LEFT JOIN direct_referrals dr
            ON dr.referred_user_id = u.id

          WHERE
            u.id = $1
            AND u.role = 'user'


          UNION ALL


          SELECT
            sponsor.id,
            sponsor.name,
            sponsor.phone,
            sponsor.account_id,

            sponsorReferral.sponsor_user_id,

            referral_chain.depth + 1

          FROM referral_chain

          JOIN users sponsor
            ON sponsor.id =
               referral_chain.sponsor_user_id
           AND sponsor.role = 'user'

          LEFT JOIN direct_referrals sponsorReferral
            ON sponsorReferral.referred_user_id =
               sponsor.id

          WHERE
            referral_chain.sponsor_user_id
            IS NOT NULL

        )

        SELECT
          id,
          name,
          phone,
          account_id,
          sponsor_user_id,
          depth

        FROM referral_chain

        ORDER BY depth DESC
        `,
        [userId]
      );

    return Response.json({
      user,
      referralCode,
      sponsor,
      referrals:
        referralsResult.rows,
      referralChain:
        referralChainResult.rows
    });

  } catch (error) {
    console.error(
      "ADMIN TEAM EXPANSION USER ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load referral information."
      },
      { status: 500 }
    );
  }
}
