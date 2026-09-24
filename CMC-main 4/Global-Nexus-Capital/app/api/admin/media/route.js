import path from "path";
import { randomUUID } from "crypto";
import {
  verifySessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/session.js";
import { uploadToStorage } from "@/lib/storage.js";

function admin(request) {
  const c = request.headers.get("cookie") || "";

  const m = c.match(
    new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`)
  );

  const s = m ? verifySessionToken(m[1]) : null;

  return s && s.role === "admin" ? s : null;
}

function sanitizeFolder(value) {
  return (
    String(value || "admin-media")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 80) || "admin-media"
  );
}

export async function POST(request) {
  if (!admin(request)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    const folder = sanitizeFolder(
      form.get("folder")
    );

    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    const allowed = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".pdf",
    ];

    const originalName = String(
      file.name || "file.jpg"
    );

    const ext =
      path.extname(originalName).toLowerCase() ||
      ".jpg";

    if (!allowed.includes(ext)) {
      return Response.json(
        { error: "Unsupported file type." },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return Response.json(
        { error: "File must be 15MB or smaller." },
        { status: 400 }
      );
    }

    const filename = `${randomUUID()}${ext}`;
    const key = `${folder}/${filename}`;

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const uploaded = await uploadToStorage({
      key,
      body: buffer,
      contentType:
        file.type || "application/octet-stream",
      contentLength: buffer.length,
    });

    return Response.json({
      url: uploaded.url,
      key: uploaded.key,
    });
  } catch (error) {
    console.error(
      "Admin media upload failed:",
      error
    );

    return Response.json(
      { error: "Upload failed." },
      { status: 500 }
    );
  }
}
