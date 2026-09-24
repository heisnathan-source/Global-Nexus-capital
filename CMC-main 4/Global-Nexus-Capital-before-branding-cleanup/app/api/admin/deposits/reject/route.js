import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This legacy deposit rejection endpoint is disabled. Use the canonical deposit management endpoint."
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This legacy deposit rejection endpoint is disabled. Use the canonical deposit management endpoint."
    },
    { status: 410 }
  );
}
