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

    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json(
        { error: "No image file was provided." },
        { status: 400 }
      );
    }

    const allowed = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
    ];

    const originalName = String(
      file.name || "image.jpg"
    );

    const extension =
      path.extname(originalName).toLowerCase() ||
      ".jpg";

    if (!allowed.includes(extension)) {
      return Response.json(
        {
          error:
            "Only JPG, JPEG, PNG, WEBP and GIF images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "Image must be 10MB or smaller." },
        { status: 400 }
      );
    }

    const filename = `${randomUUID()}${extension}`;
    const key = `task-images/${filename}`;

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
      imageUrl: uploaded.url,
      key: uploaded.key,
    });
  } catch (error) {
    console.error(
      "Task image upload failed:",
      error
    );

    return Response.json(
      { error: "Image upload failed." },
      { status: 500 }
    );
  }
}
