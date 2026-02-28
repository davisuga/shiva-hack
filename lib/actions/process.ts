"use server";

import { requireUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const DEFAULT_RECEIPT_PROCESSOR_URL = "http://localhost:8000/process";
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

export type UploadReceiptState = {
  status: "idle" | "success" | "error";
  message?: string;
  processId?: string;
};

export async function submitReceiptForProcessing(
  _prevState: UploadReceiptState,
  formData: FormData
): Promise<UploadReceiptState> {
  const userId = await requireUserId();
  const file = formData.get("receiptImage");

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Select an image before submitting.",
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      status: "error",
      message: "Only image files are supported.",
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      status: "error",
      message: "Image is too large. Use a file up to 8MB.",
    };
  }

  const processorUrl =
    process.env.RECEIPT_PROCESSOR_URL || DEFAULT_RECEIPT_PROCESSOR_URL;
  const processId = crypto.randomUUID();

  try {
    const imageB64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const response = await fetch(processorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        process_id: processId,
        user_id: userId,
        image_b64: imageB64,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `Processor request failed (${response.status}).`,
      };
    }

    const nowIso = new Date().toISOString();
    await prisma.processStatus.upsert({
      where: {
        processId,
      },
      update: {
        status: "queued",
        errorMessage: null,
        updatedAt: nowIso,
      },
      create: {
        processId,
        status: "queued",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/upload");

    return {
      status: "success",
      processId,
      message: "Receipt queued. Notia is processing your image.",
    };
  } catch {
    return {
      status: "error",
      message: "Could not send image to processor. Try again.",
    };
  }
}
