/*
 * Deprecated endpoint.
 *
 * Account Security now uses /api/admin/identity-verifications.
 * Keeping this route explicitly disabled prevents older clients or
 * bookmarks from applying the old identity-only update behavior.
 */

export async function GET() {
  return Response.json(
    {
      error: "This endpoint has been retired. Use /api/admin/identity-verifications."
    },
    { status: 410 }
  );
}

export async function POST() {
  return Response.json(
    {
      error: "This endpoint has been retired. Use /api/admin/identity-verifications."
    },
    { status: 410 }
  );
}
