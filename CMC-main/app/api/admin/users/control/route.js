import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This legacy user-control endpoint is disabled. Use the canonical user action endpoint."
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This legacy user-control endpoint is disabled. Use the canonical user action endpoint."
    },
    { status: 410 }
  );
}
