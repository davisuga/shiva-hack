import { auth } from "@/lib/auth";
import {
  createPresignedReceiptUpload,
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
} from "@/lib/r2-storage";

type RequestBody = {
  fileName?: string;
  contentType?: string;
  fileSizeBytes?: number;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return Response.json(
      {
        ok: false,
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  let body: RequestBody | null = null;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      {
        ok: false,
        message: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  const fileName = body?.fileName?.trim();
  const contentType = body?.contentType?.trim() ?? "";
  const fileSizeBytes = Number(body?.fileSizeBytes);

  if (!fileName) {
    return Response.json(
      {
        ok: false,
        message: "Missing file name.",
      },
      { status: 400 },
    );
  }

  if (!contentType.startsWith("image/")) {
    return Response.json(
      {
        ok: false,
        message: "Only image files are supported.",
      },
      { status: 400 },
    );
  }

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return Response.json(
      {
        ok: false,
        message: "Invalid file size.",
      },
      { status: 400 },
    );
  }

  if (fileSizeBytes > MAX_RECEIPT_IMAGE_SIZE_BYTES) {
    return Response.json(
      {
        ok: false,
        message: "Image is too large. Use a file up to 8MB.",
      },
      { status: 400 },
    );
  }

  try {
    const upload = await createPresignedReceiptUpload({
      fileName,
      contentType,
      fileSizeBytes,
    });

    return Response.json({
      ok: true,
      upload,
    });
  } catch (error) {
    console.error("Could not create receipt upload URL:", error);
    return Response.json(
      {
        ok: false,
        message: "Could not create upload URL.",
      },
      { status: 500 },
    );
  }
}
