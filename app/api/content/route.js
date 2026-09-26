import { getDb } from "@/lib/db.js";

const PUBLIC_CONTENT_KEYS = new Set([
  "app_download",
  "company_activity",
  "home_promotion",
  "privacy_policy",
  "promotional_brochure",
  "business_license",
  "business_certificate",
]);

export async function GET(request) {
  try {
    const key = new URL(request.url).searchParams.get("key");

    if (!key) {
      return Response.json(
        { error: "Content key is required." },
        { status: 400 }
      );
    }

    if (!PUBLIC_CONTENT_KEYS.has(key)) {
      return Response.json(
        { error: "Content not found." },
        { status: 404 }
      );
    }

    const db = getDb();

    const result = await db.query(
      `
      SELECT
        page_key,
        title,
        content,
        banner_url,
        active,
        updated_at
      FROM content_pages
      WHERE page_key = $1
        AND page_key = ANY($2::text[])
      `,
      [key, Array.from(PUBLIC_CONTENT_KEYS)]
    );

    if (!result.rowCount) {
      return Response.json(
        { error: "Content not found." },
        { status: 404 }
      );
    }

    return Response.json({
      content: result.rows[0],
    });
  } catch (error) {
    console.error("Public content GET error:", error);

    return Response.json(
      { error: "Unable to load content." },
      { status: 500 }
    );
  }
}
