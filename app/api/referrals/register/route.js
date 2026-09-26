/*
 * Legacy referral-registration endpoint.
 *
 * Direct referral relationships are now created exclusively
 * during account registration through /api/auth/register.
 *
 * Keeping this endpoint disabled prevents users from changing
 * or creating sponsor relationships after registration.
 */

export async function POST() {
  return Response.json(
    {
      error:
        "This referral endpoint is no longer available."
    },
    { status: 410 }
  );
}
