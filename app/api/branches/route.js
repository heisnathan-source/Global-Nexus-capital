import { getDb } from "@/lib/db.js";

export async function GET() {
  try {
    const db = getDb();

    const result = await db.query(`
      SELECT
        id,
        name,
        location,
        description,
        image_url,
        display_order
      FROM branches
      WHERE active = TRUE
      ORDER BY display_order, id
    `);

    return Response.json({
      branches: result.rows,
    });
  } catch (error) {
    console.error("Public branches GET error:", error);

    return Response.json(
      {
        error: "Unable to load branches.",
      },
      {
        status: 500,
      }
    );
  }
}
