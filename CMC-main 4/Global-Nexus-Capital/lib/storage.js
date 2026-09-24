import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.BUCKET;
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const endpoint = process.env.ENDPOINT;
const region = process.env.REGION || "auto";

function requireStorageConfig() {
  const missing = [];

  if (!bucket) missing.push("BUCKET");
  if (!accessKeyId) missing.push("ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("SECRET_ACCESS_KEY");
  if (!endpoint) missing.push("ENDPOINT");

  if (missing.length) {
    throw new Error(
      `Storage is not configured. Missing environment variables: ${missing.join(", ")}`
    );
  }
}

function forcePathStyle() {
  const value = String(process.env.S3_FORCE_PATH_STYLE || "").trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;

  // Railway Buckets normally use virtual-hosted-style URLs. Keep that
  // as the default, while allowing older/path-style buckets to opt in.
  return false;
}

export function getStorageClient() {
  requireStorageConfig();

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: forcePathStyle(),
  });
}

function encodeStorageKey(key) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function contentTypeFromKey(key) {
  const ext = String(key || "")
    .split("?")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };

  return types[ext] || "application/octet-stream";
}

export async function uploadToStorage({
  key,
  body,
  contentType,
  contentLength,
}) {
  requireStorageConfig();

  if (!key || typeof key !== "string") {
    throw new Error("Storage object key is required.");
  }

  if (!body) {
    throw new Error("Storage upload body is required.");
  }

  const client = getStorageClient();
  const resolvedContentType =
    contentType || contentTypeFromKey(key);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: resolvedContentType,
    ...(Number.isFinite(contentLength)
      ? { ContentLength: contentLength }
      : {}),
  });

  await client.send(command);

  return {
    key,
    contentType: resolvedContentType,
    url: `/api/media/${encodeStorageKey(key)}`,
  };
}

export async function getFromStorage(key) {
  requireStorageConfig();

  if (!key || typeof key !== "string") {
    throw new Error("Storage object key is required.");
  }

  const client = getStorageClient();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return client.send(command);
}

export function getContentTypeFromKey(key) {
  return contentTypeFromKey(key);
}
