import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This legacy withdrawal-users endpoint is disabled. Use the canonical withdrawal-frequency-users endpoint.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This legacy withdrawal-users endpoint is disabled. Use the canonical withdrawal-frequency-users endpoint.",
    },
    { status: 410 }
  );
}
