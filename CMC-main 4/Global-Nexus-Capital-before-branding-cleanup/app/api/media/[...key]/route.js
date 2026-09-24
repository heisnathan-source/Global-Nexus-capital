import { getFromStorage } from "@/lib/storage.js";

function contentDisposition(contentType) {
  if (
    contentType &&
    (
      contentType.startsWith("image/") ||
      contentType === "application/pdf"
    )
  ) {
    return "inline";
  }

  return "attachment";
}

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const parts = resolvedParams?.key;

    if (!Array.isArray(parts) || parts.length === 0) {
      return new Response("Media not found.", {
        status: 404,
      });
    }

    const key = parts
      .map((part) => decodeURIComponent(part))
      .join("/");

    if (
      !key ||
      key.includes("..") ||
      key.startsWith("/") ||
      key.includes("\\")
    ) {
      return new Response("Invalid media key.", {
        status: 400,
      });
    }

    const object = await getFromStorage(key);

    if (!object.Body) {
      return new Response("Media not found.", {
        status: 404,
      });
    }

    const body = await object.Body.transformToByteArray();

    const contentType =
      object.ContentType ||
      "application/octet-stream";

    const headers = new Headers();

    headers.set(
      "Content-Type",
      contentType
    );

    headers.set(
      "Content-Length",
      String(body.byteLength)
    );

    headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    headers.set(
      "Content-Disposition",
      `${contentDisposition(contentType)}`
    );

    return new Response(body, {
      status: 200,
      headers,
    });
  } catch (e) {
    const status = e?.$metadata?.httpStatusCode;

    if (
      status === 404 ||
      e?.name === "NoSuchKey"
    ) {
      return new Response(
        "Media not found.",
        { status: 404 }
      );
    }

    console.error(
      "Media retrieval failed:",
      e
    );

    return new Response(
      "Unable to retrieve media.",
      { status: 500 }
    );
  }
}
