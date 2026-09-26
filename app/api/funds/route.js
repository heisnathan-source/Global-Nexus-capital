import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This legacy funds endpoint is disabled. Use the canonical fund products endpoint.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This legacy funds endpoint is disabled. Use the canonical fund products endpoint.",
    },
    { status: 410 }
  );
}
