"use server";

import { requireUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const DEFAULT_RECEIPT_PROCESSOR_BASE_URL =
  "http://shiva-hack-worker-x7xlvu-ef2c9a-216-126-235-10.traefik.me/";
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

export type UploadReceiptState = {
  status: "idle" | "success" | "error";
  message?: string;
  processId?: string;
  processingStatus?: string;
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

  const baseUrl = getProcessorBaseUrl();
  const processUrl = `${baseUrl}/process`;
  const processId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  try {
    const imageB64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    await prisma.processStatus.upsert({
      where: { processId },
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

    const response = await fetch(processUrl, {
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
      await prisma.processStatus.update({
        where: { processId },
        data: {
          status: "error",
          errorMessage: `Processor request failed (${response.status})`,
          updatedAt: new Date().toISOString(),
        },
      });
      return {
        status: "error",
        message: `Processor request failed (${response.status}).`,
        processId,
      };
    }

    const responseData = await safeJson<{
      process_id?: string;
      status?: string;
      message?: string;
    }>(response);
    const processingStatus = responseData?.status || "queued";

    await prisma.processStatus.update({
      where: {
        processId,
      },
      data: {
        status: processingStatus,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/upload");

    return {
      status: "success",
      processId,
      processingStatus,
      message:
        responseData?.message || "Receipt queued. Notia is processing your image.",
    };
  } catch {
    await prisma.processStatus.upsert({
      where: { processId },
      update: {
        status: "error",
        errorMessage: "Could not send image to processor.",
        updatedAt: new Date().toISOString(),
      },
      create: {
        processId,
        status: "error",
        errorMessage: "Could not send image to processor.",
        createdAt: nowIso,
        updatedAt: new Date().toISOString(),
      },
    });

    return {
      status: "error",
      message: "Could not send image to processor. Try again.",
      processId,
    };
  }
}

export async function syncReceiptProcessingStatus(
  processId: string
): Promise<{
  ok: boolean;
  processId: string;
  status?: string;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "worker" | "database";
  message?: string;
}> {
  await requireUserId();

  if (!processId) {
    return {
      ok: false,
      processId,
      message: "Missing process_id.",
    };
  }

  const baseUrl = getProcessorBaseUrl();
  const statusUrl = `${baseUrl}/status/${encodeURIComponent(processId)}`;

  try {
    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = await safeJson<{
        process_id: string;
        status: string;
        error_message: string | null;
        created_at: string;
        updated_at: string;
      }>(response);

      if (data?.process_id && data?.status) {
        await prisma.processStatus.upsert({
          where: { processId: data.process_id },
          update: {
            status: data.status,
            errorMessage: data.error_message,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
          create: {
            processId: data.process_id,
            status: data.status,
            errorMessage: data.error_message,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/upload");

        return {
          ok: true,
          processId: data.process_id,
          status: data.status,
          errorMessage: data.error_message,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          source: "worker",
        };
      }
    }
  } catch {
    // fall back to local database status
  }

  const localStatus = await prisma.processStatus.findUnique({
    where: { processId },
  });

  if (!localStatus) {
    return {
      ok: false,
      processId,
      message: "Process not found.",
    };
  }

  return {
    ok: true,
    processId: localStatus.processId,
    status: localStatus.status,
    errorMessage: localStatus.errorMessage,
    createdAt: localStatus.createdAt,
    updatedAt: localStatus.updatedAt,
    source: "database",
  };
}

function getProcessorBaseUrl() {
  const raw =
    process.env.RECEIPT_PROCESSOR_BASE_URL ||
    process.env.RECEIPT_PROCESSOR_URL ||
    DEFAULT_RECEIPT_PROCESSOR_BASE_URL;

  return raw.replace(/\/+$/, "");
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
