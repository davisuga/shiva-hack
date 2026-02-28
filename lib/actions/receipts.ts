"use server";

import { requireUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
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
  return { success: true, receipt };
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

  await prisma.receipt.delete({
    where: { id },
  });

  revalidatePath("/dashboard");
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
