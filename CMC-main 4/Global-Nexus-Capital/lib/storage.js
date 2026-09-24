import https from "node:https";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

function env(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return "";
}

function getConfig() {
  let endpoint = env(
    "ENDPOINT",
    "AWS_ENDPOINT_URL"
  );

  // Remove accidental trailing slashes.
  endpoint = endpoint.replace(/\/+$/, "");

  return {
    bucket: env(
      "BUCKET",
      "AWS_S3_BUCKET_NAME",
      "AWS_S3_BUCKET"
    ),

    accessKeyId: env(
      "ACCESS_KEY_ID",
      "AWS_ACCESS_KEY_ID"
    ),

    secretAccessKey: env(
      "SECRET_ACCESS_KEY",
      "AWS_SECRET_ACCESS_KEY"
    ),

    endpoint,

    region:
      env(
        "REGION",
        "AWS_DEFAULT_REGION"
      ) || "auto",
  };
}

function requireConfig() {
  const config = getConfig();
  const missing = [];

  if (!config.bucket) missing.push("BUCKET");
  if (!config.accessKeyId) missing.push("ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("SECRET_ACCESS_KEY");
  if (!config.endpoint) missing.push("ENDPOINT");

  if (missing.length) {
    throw new Error(
      `Storage is not configured. Missing environment variables: ${missing.join(
        ", "
      )}`
    );
  }

  try {
    const url = new URL(config.endpoint);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Endpoint must use http:// or https://");
    }
  } catch {
    throw new Error(
      `Invalid storage ENDPOINT: ${config.endpoint}`
    );
  }

  return config;
}

function forcePathStyle() {
  const value = env("S3_FORCE_PATH_STYLE").toLowerCase();

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  // Railway Buckets normally use virtual-hosted style.
  return false;
}

function encodeStorageKey(key) {
  return String(key)
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
    txt: "text/plain",
    csv: "text/csv",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };

  return types[ext] || "application/octet-stream";
}

function resolveContentType(contentType, key) {
  const supplied = String(contentType || "")
    .trim()
    .toLowerCase();

  if (
    !supplied ||
    supplied === "application/octet-stream" ||
    supplied === "binary/octet-stream"
  ) {
    return contentTypeFromKey(key);
  }

  return supplied;
}

let client = null;
let clientSignature = "";

export function getStorageClient() {
  const config = requireConfig();

  const signature = [
    config.endpoint,
    config.region,
    config.accessKeyId,
    config.bucket,
    forcePathStyle(),
  ].join("|");

  // Recreate the client automatically if Railway environment
  // configuration changes during the process lifetime.
  if (client && clientSignature === signature) {
    return client;
  }

  const httpsAgent = new https.Agent({
    keepAlive: false,
    maxSockets: 25,
    maxFreeSockets: 0,
  });

  client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,

    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },

    forcePathStyle: forcePathStyle(),

    // Let the AWS SDK retry transient network failures.
    maxAttempts: 5,

    requestHandler: new NodeHttpHandler({
      connectionTimeout: 20_000,
      socketTimeout: 120_000,
      httpsAgent,
    }),
  });

  clientSignature = signature;

  return client;
}

export async function uploadToStorage({
  key,
  body,
  contentType,
  contentLength,
}) {
  const config = requireConfig();

  if (!key || typeof key !== "string") {
    throw new Error("Storage object key is required.");
  }

  if (!body) {
    throw new Error("Storage upload body is required.");
  }

  const resolvedContentType = resolveContentType(
    contentType,
    key
  );

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: resolvedContentType,

    ...(Number.isFinite(contentLength)
      ? {
          ContentLength: contentLength,
        }
      : {}),
  });

  try {
    await getStorageClient().send(command);
  } catch (error) {
    console.error("S3 upload failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
    });

    throw error;
  }

  return {
    key,
    contentType: resolvedContentType,
    url: `/api/media/${encodeStorageKey(key)}`,
  };
}

export async function getFromStorage(key) {
  const config = requireConfig();

  if (!key || typeof key !== "string") {
    throw new Error("Storage object key is required.");
  }

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  try {
    return await getStorageClient().send(command);
  } catch (error) {
    console.error("S3 download failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
    });

    throw error;
  }
}

export function getContentTypeFromKey(key) {
  return contentTypeFromKey(key);
}
