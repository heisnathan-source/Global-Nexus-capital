import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This legacy referrals endpoint is disabled.",
    },
    { status: 410 }
  );
}
