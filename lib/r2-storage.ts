import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_RECEIPT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const RECEIPT_OBJECT_PREFIX = "recepts";
const DEFAULT_UPLOAD_TTL_SECONDS = 60 * 5;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 60 * 15;

type R2Config = {
  endpointUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export type PresignedReceiptUploadInput = {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
};

export type PresignedReceiptUpload = {
  bucketName: string;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null = null;

function getRequiredEnv(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getR2Config(): R2Config {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    endpointUrl: getRequiredEnv("R2_ENDPOINT_URL"),
    accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    bucketName: getRequiredEnv("R2_BUCKET_NAME"),
  };

  return cachedConfig;
}

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const config = getR2Config();

  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpointUrl,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

function sanitizeBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const ascii = withoutExt.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const safe = ascii
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return safe || "receipt";
}

function normalizeExtension(fileName: string, contentType: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
  if (match?.[1]) {
    return match[1];
  }

  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";

  return "jpg";
}

function toUtcParts(date: Date) {
  const year = `${date.getUTCFullYear()}`;
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hour = `${date.getUTCHours()}`.padStart(2, "0");
  const minute = `${date.getUTCMinutes()}`.padStart(2, "0");
  const second = `${date.getUTCSeconds()}`.padStart(2, "0");

  return { year, month, day, hour, minute, second };
}

function assertSupportedImage(contentType: string) {
  if (!contentType.startsWith("image/")) {
    throw new Error("Only image files are supported.");
  }
}

function assertReceiptObjectKey(objectKey: string) {
  if (!objectKey.startsWith(`${RECEIPT_OBJECT_PREFIX}/`)) {
    throw new Error("Invalid receipt object key.");
  }
}

export function buildReceiptObjectKey(
  fileName: string,
  contentType: string,
  now = new Date(),
): string {
  const { year, month, day, hour, minute, second } = toUtcParts(now);
  const timestamp = `${year}${month}${day}T${hour}${minute}${second}Z`;
  const sequence = Math.floor(Math.random() * 9_999) + 1;
  const baseName = sanitizeBaseName(fileName);
  const extension = normalizeExtension(fileName, contentType);

  return `${RECEIPT_OBJECT_PREFIX}/${year}/${month}/${day}/${timestamp}_${sequence}_${baseName}.${extension}`;
}

export async function createPresignedReceiptUpload(
  input: PresignedReceiptUploadInput,
): Promise<PresignedReceiptUpload> {
  const { fileName, contentType, fileSizeBytes } = input;

  assertSupportedImage(contentType);

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("Invalid file size.");
  }

  if (fileSizeBytes > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
    throw new Error("Image is too large. Use a file up to 8MB.");
  }

  const client = getR2Client();
  const { bucketName } = getR2Config();
  const objectKey = buildReceiptObjectKey(fileName, contentType);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: DEFAULT_UPLOAD_TTL_SECONDS,
  });

  return {
    bucketName,
    objectKey,
    uploadUrl,
    expiresInSeconds: DEFAULT_UPLOAD_TTL_SECONDS,
  };
}

export async function createPresignedReceiptDownloadUrl(
  objectKey: string,
  expiresInSeconds = DEFAULT_DOWNLOAD_TTL_SECONDS,
) {
  assertReceiptObjectKey(objectKey);

  const client = getR2Client();
  const { bucketName } = getR2Config();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function readReceiptObjectAsBase64(objectKey: string) {
  assertReceiptObjectKey(objectKey);

  const client = getR2Client();
  const { bucketName } = getR2Config();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error("Uploaded file is empty.");
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes).toString("base64");
}
