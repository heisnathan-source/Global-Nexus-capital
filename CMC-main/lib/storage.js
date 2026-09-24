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

export function getStorageClient() {
  requireStorageConfig();

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
  });
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

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || "application/octet-stream",
    ...(Number.isFinite(contentLength)
      ? { ContentLength: contentLength }
      : {}),
  });

  await client.send(command);

  return {
    key,
    url: `/api/media/${key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`,
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
