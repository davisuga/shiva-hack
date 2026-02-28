"use server";

import { requireUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type CreateItemInput = {
  receiptId: string;
  rawName: string;
  normalizedName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type UpdateItemInput = {
  rawName?: string;
  normalizedName?: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
};

export async function createItem(input: CreateItemInput) {
  const userId = await requireUserId();

  const receipt = await prisma.receipt.findFirst({
    where: {
      id: input.receiptId,
      userId,
    },
  });

  if (!receipt) {
    return { success: false, error: "Receipt not found" };
  }

  const item = await prisma.item.create({
    data: input,
  });

  revalidatePath("/dashboard");
  return { success: true, item };
}

export async function getItemsByReceipt(receiptId: string) {
  const userId = await requireUserId();

  const receipt = await prisma.receipt.findFirst({
    where: {
      id: receiptId,
      userId,
    },
  });

  if (!receipt) {
    return { success: false, error: "Receipt not found" };
  }

  const items = await prisma.item.findMany({
    where: {
      receiptId,
    },
    orderBy: {
      totalPrice: "desc",
    },
  });

  return { success: true, items };
}

export async function getItemsByNormalizedName(normalizedName: string) {
  const userId = await requireUserId();

  const items = await prisma.item.findMany({
    where: {
      normalizedName,
      receipt: {
        userId,
      },
    },
    include: {
      receipt: {
        select: {
          date: true,
          currency: true,
        },
      },
    },
    orderBy: {
      receipt: {
        date: "desc",
      },
    },
  });

  return { success: true, items };
}

export async function getItemStats(normalizedName: string, options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const userId = await requireUserId();

  const where = {
    normalizedName,
    receipt: {
      userId,
      ...(options?.startDate || options?.endDate
        ? {
            date: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
  };

  const [items, aggregation] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        receipt: {
          select: {
            date: true,
          },
        },
      },
    }),
    prisma.item.aggregate({
      where,
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      _avg: {
        unitPrice: true,
      },
    }),
  ]);

  return {
    success: true,
    stats: {
      totalQuantity: aggregation._sum.quantity || 0,
      totalSpent: aggregation._sum.totalPrice || 0,
      averageUnitPrice: aggregation._avg.unitPrice || 0,
      purchaseCount: items.length,
      items,
    },
  };
}

export async function getProductGroups(options?: {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const userId = await requireUserId();

  const where = {
    receipt: {
      userId,
      ...(options?.startDate || options?.endDate
        ? {
            date: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
  };

  const groupedItems = await prisma.item.groupBy({
    by: ["normalizedName", "category"],
    where,
    _sum: {
      quantity: true,
      totalPrice: true,
    },
    _avg: {
      unitPrice: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: {
        totalPrice: "desc",
      },
    },
    take: options?.limit,
  });

  return {
    success: true,
    groups: groupedItems.map((group) => ({
      normalizedName: group.normalizedName,
      category: group.category,
      totalQuantity: group._sum.quantity || 0,
      totalSpent: group._sum.totalPrice || 0,
      averageUnitPrice: group._avg.unitPrice || 0,
      purchaseCount: group._count.id,
    })),
  };
}

export async function updateItem(id: string, input: UpdateItemInput) {
  const userId = await requireUserId();

  const existing = await prisma.item.findFirst({
    where: {
      id,
      receipt: {
        userId,
      },
    },
  });

  if (!existing) {
    return { success: false, error: "Item not found" };
  }

  const item = await prisma.item.update({
    where: { id },
    data: input,
  });

  revalidatePath("/dashboard");
  return { success: true, item };
}

export async function deleteItem(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.item.findFirst({
    where: {
      id,
      receipt: {
        userId,
      },
    },
  });

  if (!existing) {
    return { success: false, error: "Item not found" };
  }

  await prisma.item.delete({
    where: { id },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getCategoryStats(options?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const userId = await requireUserId();

  const where = {
    receipt: {
      userId,
      ...(options?.startDate || options?.endDate
        ? {
            date: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
  };

  const categoryGroups = await prisma.item.groupBy({
    by: ["category"],
    where,
    _sum: {
      totalPrice: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: {
        totalPrice: "desc",
      },
    },
  });

  return {
    success: true,
    categories: categoryGroups.map((group) => ({
      category: group.category,
      totalSpent: group._sum.totalPrice || 0,
      itemCount: group._count.id,
    })),
  };
}
