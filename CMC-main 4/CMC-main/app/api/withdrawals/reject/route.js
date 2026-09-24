import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This legacy withdrawal endpoint is disabled. Use the canonical withdrawal management endpoint.",
    },
    { status: 410 }
  );
}
