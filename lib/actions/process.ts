"use server";

import { requireUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import {
  createPresignedReceiptDownloadUrl,
  MAX_RECEIPT_IMAGE_SIZE_BYTES,
  readReceiptObjectAsBase64,
} from "@/lib/r2-storage";
import {
  isTerminalProcessStatus,
  normalizeProcessStatus,
  ProcessStatus,
} from "@/lib/process-status";
import { revalidatePath } from "next/cache";

const DEFAULT_RECEIPT_PROCESSOR_BASE_URL =
  "http://shiva-hack-worker-x7xlvu-ef2c9a-216-126-235-10.traefik.me/";

export type UploadReceiptState = {
  status: "idle" | "success" | "error";
  message?: string;
  processId?: string;
  processingStatus?: ProcessStatus;
};

export type ProcessingStatusResult = {
  ok: boolean;
  processId: string;
  status?: ProcessStatus;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "database";
  message?: string;
};

export async function submitReceiptForProcessing(
  _prevState: UploadReceiptState,
  formData: FormData,
): Promise<UploadReceiptState> {
  const userId = await requireUserId();
  const objectKeyRaw = formData.get("receiptObjectKey");
  const objectKey =
    typeof objectKeyRaw === "string" && objectKeyRaw.trim()
      ? objectKeyRaw.trim()
      : null;
  const file = formData.get("receiptImage");

  if (!objectKey && (!(file instanceof File) || file.size === 0)) {
    return {
      status: "error",
      message: "Select an image before submitting.",
    };
  }

  if (!objectKey && file instanceof File && !file.type.startsWith("image/")) {
    return {
      status: "error",
      message: "Only image files are supported.",
    };
  }

  if (
    !objectKey &&
    file instanceof File &&
    file.size > MAX_RECEIPT_IMAGE_SIZE_BYTES
  ) {
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
    const imageB64 = objectKey
      ? await readReceiptObjectAsBase64(objectKey)
      : Buffer.from(await (file as File).arrayBuffer()).toString("base64");

    const imageUrl = objectKey
      ? await createPresignedReceiptDownloadUrl(objectKey)
      : undefined;

    await prisma.processStatus.upsert({
      where: { processId },
      update: {
        status: ProcessStatus.PROCESSING,
        errorMessage: null,
        updatedAt: nowIso,
      },
      create: {
        processId,
        status: ProcessStatus.PROCESSING,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    });
    console.log("Submitting receipt for processing", {
      processId,
      processUrl,
      userId,
      source: objectKey ? "r2" : "direct",
      objectKey,
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
        image_url: imageUrl,
        object_key: objectKey,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      await prisma.processStatus.update({
        where: { processId },
        data: {
          status: ProcessStatus.ERROR,
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
    const processingStatus = normalizeProcessStatus(responseData?.status);

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
        responseData?.message ||
        "Receipt queued. Notia is processing your image.",
    };
  } catch {
    await prisma.processStatus.upsert({
      where: { processId },
      update: {
        status: ProcessStatus.ERROR,
        errorMessage: "Could not send image to processor.",
        updatedAt: new Date().toISOString(),
      },
      create: {
        processId,
        status: ProcessStatus.ERROR,
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
  processId: string,
): Promise<ProcessingStatusResult> {
  await requireUserId();
  return getReceiptProcessingStatusFromDatabase(processId);
}

export async function cancelReceiptProcessing(
  processId: string,
): Promise<ProcessingStatusResult> {
  await requireUserId();

  if (!processId) {
    return {
      ok: false,
      processId,
      message: "Missing process_id.",
    };
  }

  const current = await prisma.processStatus.findUnique({
    where: { processId },
  });

  if (!current) {
    return {
      ok: false,
      processId,
      message: "Process not found.",
    };
  }

  if (isTerminalStatus(current.status)) {
    return {
      ok: true,
      processId: current.processId,
      status: normalizeProcessStatus(current.status),
      errorMessage: current.errorMessage,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      source: "database",
      message: "Process already finalized.",
    };
  }

  const canceled = await prisma.processStatus.update({
    where: { processId },
    data: {
      status: ProcessStatus.ERROR,
      errorMessage: "Canceled by user.",
      updatedAt: new Date().toISOString(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upload");

  return {
    ok: true,
    processId: canceled.processId,
    status: normalizeProcessStatus(canceled.status),
    errorMessage: canceled.errorMessage,
    createdAt: canceled.createdAt,
    updatedAt: canceled.updatedAt,
    source: "database",
  };
}

export async function syncReceiptProcessingStatuses(
  processIds: string[],
): Promise<{ ok: boolean; results: ProcessingStatusResult[] }> {
  await requireUserId();

  const uniqueProcessIds = Array.from(
    new Set(
      processIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).slice(0, 20);

  if (uniqueProcessIds.length === 0) {
    return { ok: true, results: [] };
  }

  const rows = await prisma.processStatus.findMany({
    where: {
      processId: {
        in: uniqueProcessIds,
      },
    },
    select: {
      processId: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const byProcessId = new Map(rows.map((row) => [row.processId, row]));
  const results = uniqueProcessIds.map((processId) => {
    const row = byProcessId.get(processId);
    if (!row) {
      return {
        ok: false,
        processId,
        message: "Process not found.",
      } satisfies ProcessingStatusResult;
    }

    return {
      ok: true,
      processId: row.processId,
      status: normalizeProcessStatus(row.status),
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      source: "database",
    } satisfies ProcessingStatusResult;
  });

  return {
    ok: true,
    results,
  };
}

async function getReceiptProcessingStatusFromDatabase(
  processId: string,
): Promise<ProcessingStatusResult> {
  if (!processId) {
    return {
      ok: false,
      processId,
      message: "Missing process_id.",
    };
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
    status: normalizeProcessStatus(localStatus.status),
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

function isTerminalStatus(status?: string) {
  return isTerminalProcessStatus(status);
}
