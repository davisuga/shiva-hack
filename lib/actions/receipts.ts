"use server";

import { requireUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ITEM_UNIT,
  isItemUnit,
  type ItemUnit,
} from "@/lib/item-units";
import { revalidatePath } from "next/cache";

export type CreateReceiptInput = {
  date: Date;
  totalAmount: number;
  currency?: string;
  imageUrl?: string;
  items: {
    rawName: string;
    normalizedName: string;
    category: string;
    quantity: number;
    unit: ItemUnit;
    unitPrice: number;
    totalPrice: number;
  }[];
};

export type UpdateReceiptInput = {
  date?: Date;
  totalAmount?: number;
  currency?: string;
  imageUrl?: string;
};

export type CreateManualReceiptState = {
  status: "idle" | "processado" | "error";
  message?: string;
  receiptId?: string;
};

export type DeleteManualReceiptState = {
  status: "idle" | "processado" | "error";
  message?: string;
  receiptId?: string;
};

const initialManualState: CreateManualReceiptState = {
  status: "idle",
};

const initialDeleteManualState: DeleteManualReceiptState = {
  status: "idle",
};

export async function createReceipt(input: CreateReceiptInput) {
  const userId = await requireUserId();

  const receipt = await prisma.receipt.create({
    data: {
      userId,
      date: input.date,
      totalAmount: input.totalAmount,
      currency: input.currency || "BRL",
      imageUrl: input.imageUrl,
      items: {
        create: input.items,
      },
    },
    include: {
      items: true,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upload");
  return { success: true, receipt };
}

export async function createManualParsedReceipt(
  prevState: CreateManualReceiptState = initialManualState,
  formData: FormData
): Promise<CreateManualReceiptState> {
  void prevState;

  const receiptIdRaw = formData.get("manualReceiptId");
  const dateRaw = formData.get("manualDate");
  const totalAmountRaw = formData.get("manualTotalAmount");
  const currencyRaw = formData.get("manualCurrency");
  const itemsJson = formData.get("manualItemsJson");

  if (typeof dateRaw !== "string" || !dateRaw.trim()) {
    return { status: "error", message: "Informe a data da nota." };
  }

  if (typeof totalAmountRaw !== "string" || !totalAmountRaw.trim()) {
    return { status: "error", message: "Informe o total da nota." };
  }

  if (typeof itemsJson !== "string" || !itemsJson.trim()) {
    return { status: "error", message: "Adicione pelo menos um item." };
  }

  const parsedDate = new Date(dateRaw);
  if (Number.isNaN(parsedDate.getTime())) {
    return { status: "error", message: "Data inválida." };
  }

  const parsedTotalAmount = Number(totalAmountRaw);
  if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
    return { status: "error", message: "Total inválido." };
  }

  let parsedItems: unknown;
  try {
    parsedItems = JSON.parse(itemsJson);
  } catch {
    return { status: "error", message: "Itens inválidos." };
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    return { status: "error", message: "Adicione pelo menos um item." };
  }

  const sanitizedItems: CreateReceiptInput["items"] = [];

  for (const item of parsedItems) {
    if (!item || typeof item !== "object") {
      return { status: "error", message: "Formato de item inválido." };
    }

    const rawName = String((item as Record<string, unknown>).rawName ?? "").trim();
    const normalizedName = String((item as Record<string, unknown>).normalizedName ?? "").trim();
    const category = String((item as Record<string, unknown>).category ?? "").trim();
    const quantity = Number((item as Record<string, unknown>).quantity ?? 0);
    const unitCandidate =
      typeof (item as Record<string, unknown>).unit === "string"
        ? String((item as Record<string, unknown>).unit).trim().toUpperCase()
        : DEFAULT_ITEM_UNIT;
    const unitPrice = Number((item as Record<string, unknown>).unitPrice ?? 0);
    const totalPriceFromPayload = Number((item as Record<string, unknown>).totalPrice ?? 0);

    if (!rawName || !normalizedName || !category) {
      return { status: "error", message: "Preencha nome, nome normalizado e categoria dos itens." };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { status: "error", message: `Quantidade inválida para "${rawName}".` };
    }

    if (!isItemUnit(unitCandidate)) {
      return { status: "error", message: `Unidade inválida para "${rawName}".` };
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { status: "error", message: `Preço unitário inválido para "${rawName}".` };
    }

    const totalPrice =
      Number.isFinite(totalPriceFromPayload) && totalPriceFromPayload > 0
        ? totalPriceFromPayload
        : quantity * unitPrice;

    sanitizedItems.push({
      rawName,
      normalizedName,
      category,
      quantity,
      unit: unitCandidate,
      unitPrice,
      totalPrice,
    });
  }

  try {
    const userId = await requireUserId();
    const safeCurrency =
      typeof currencyRaw === "string" && currencyRaw.trim()
        ? currencyRaw.trim().toUpperCase()
        : "BRL";
    const receiptId =
      typeof receiptIdRaw === "string" && receiptIdRaw.trim()
        ? receiptIdRaw.trim()
        : null;

    if (receiptId) {
      const existing = await prisma.receipt.findFirst({
        where: {
          id: receiptId,
          userId,
        },
      });

      if (!existing) {
        return {
          status: "error",
          message: "Entrada não encontrada.",
        };
      }

      const receipt = await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          date: parsedDate,
          totalAmount: parsedTotalAmount,
          currency: safeCurrency,
          items: {
            deleteMany: {},
            create: sanitizedItems,
          },
        },
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/upload");

      return {
        status: "processado",
        receiptId: receipt.id,
        message: "Entrada atualizada com sucesso.",
      };
    }

    const { receipt } = await createReceipt({
      date: parsedDate,
      totalAmount: parsedTotalAmount,
      currency: safeCurrency,
      items: sanitizedItems,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/upload");

    return {
      status: "processado",
      receiptId: receipt.id,
      message: "Nota adicionada manualmente com sucesso.",
    };
  } catch {
    return {
      status: "error",
      message: "Não foi possível salvar a nota manualmente.",
    };
  }
}

export async function deleteManualReceiptEntry(
  prevState: DeleteManualReceiptState = initialDeleteManualState,
  formData: FormData
): Promise<DeleteManualReceiptState> {
  void prevState;

  const receiptIdRaw = formData.get("manualReceiptId");
  const receiptId =
    typeof receiptIdRaw === "string" && receiptIdRaw.trim()
      ? receiptIdRaw.trim()
      : null;

  if (!receiptId) {
    return {
      status: "error",
      message: "Entrada inválida.",
    };
  }

  const deleted = await deleteReceipt(receiptId);
  if (!deleted.success) {
    return {
      status: "error",
      message: "Não foi possível excluir a entrada.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upload");

  return {
    status: "processado",
    receiptId,
    message: "Entrada excluída com sucesso.",
  };
}

export async function getReceipts(options?: {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const userId = await requireUserId();

  const where = {
    userId,
    ...(options?.startDate || options?.endDate
      ? {
          date: {
            ...(options.startDate && { gte: options.startDate }),
            ...(options.endDate && { lte: options.endDate }),
          },
        }
      : {}),
  };

  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: {
      date: "desc",
    },
    take: options?.limit,
    skip: options?.offset,
  });

  return { success: true, receipts };
}

export async function getReceiptById(id: string) {
  const userId = await requireUserId();

  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      items: true,
    },
  });

  if (!receipt) {
    return { success: false, error: "Receipt not found" };
  }

  return { success: true, receipt };
}

export async function updateReceipt(id: string, input: UpdateReceiptInput) {
  const userId = await requireUserId();

  const existing = await prisma.receipt.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { success: false, error: "Receipt not found" };
  }

  const receipt = await prisma.receipt.update({
    where: { id },
    data: input,
    include: {
      items: true,
    },
  });

  revalidatePath("/dashboard");
  return { success: true, receipt };
}

export async function deleteReceipt(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.receipt.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { success: false, error: "Receipt not found" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.item.deleteMany({
      where: { receiptId: id },
    });

    await tx.receipt.delete({
      where: { id },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upload");
  return { success: true };
}

export async function getReceiptStats(options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const userId = await requireUserId();

  const where = {
    userId,
    ...(options?.startDate || options?.endDate
      ? {
          date: {
            ...(options.startDate && { gte: options.startDate }),
            ...(options.endDate && { lte: options.endDate }),
          },
        }
      : {}),
  };

  const [totalSpent, receiptCount] = await Promise.all([
    prisma.receipt.aggregate({
      where,
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.receipt.count({ where }),
  ]);

  return {
    success: true,
    stats: {
      totalSpent: totalSpent._sum.totalAmount || 0,
      receiptCount,
    },
  };
}
