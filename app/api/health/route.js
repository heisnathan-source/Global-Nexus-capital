export async function GET() {
  return Response.json({
    ok: true,
    service: "Global Nexus Capital",
    timestamp: new Date().toISOString(),
  });
}
