import { getReceipts, getReceiptStats } from "@/lib/actions/receipts";
import { getNormalizedNameOptions, getProductGroups } from "@/lib/actions/items";
import { normalizeItemUnit, type ItemUnit } from "@/lib/item-units";
import { getTranslations } from "next-intl/server";
import HackathonDashboard, { type DashboardViewData, type ProductCardData, type SuggestionData, type WeeklySpendData } from "./hackathon-dashboard";

const CATEGORY_COLORS: Record<string, string> = {
  "Grãos": "#007aff",
  "Laticínios": "#ff3b30",
  "Bebidas": "#ff9500",
  "Limpeza": "#34c759",
  "Higiene": "#af52de",
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function DashboardPage() {
  const t = await getTranslations("DashboardRules");
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [statsResult, allReceipts, productGroups, normalizedNames, recentReceipts] =
    await Promise.all([
    getReceiptStats({ startDate: firstDayOfMonth }),
    getReceipts({ startDate: sixMonthsAgo }),
    getProductGroups({ startDate: sixMonthsAgo }),
    getNormalizedNameOptions(),
    getReceipts({ limit: 15 }),
  ]);

  const receipts = allReceipts.receipts;

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(MONTH_LABELS[d.getMonth()]);
  }

  const weekSpend: WeeklySpendData[] = buildWeeklySpend(receipts, now);

  const products: ProductCardData[] = productGroups.groups.map((g, idx) => {
    const color = CATEGORY_COLORS[g.category] || "#007aff";
    const itemsForProduct = receipts.flatMap((r) =>
      r.items.filter(
        (item) =>
          item.normalizedName === g.normalizedName &&
          normalizeItemUnit(item.unit) === g.unit
      )
    );

    const monthlyPrices = buildMonthlyValues(itemsForProduct, receipts, now, "price");
    const monthlyQtys = buildMonthlyValues(itemsForProduct, receipts, now, "qty");

    const prices = itemsForProduct.map((i) => i.unitPrice).filter((p) => p > 0);
    const latestPrice = prices.length > 0 ? prices[0] : g.averageUnitPrice;

    const oldestPrice = prices.length > 1 ? prices[prices.length - 1] : latestPrice;
    const trendPct = oldestPrice > 0 ? ((latestPrice - oldestPrice) / oldestPrice) * 100 : 0;

    return {
      id: `product-${idx}`,
      name: g.normalizedName,
      category: g.category,
      color,
      latestPrice,
      trendPct,
      trendDirection: trendPct > 0.5 ? "up" : trendPct < -0.5 ? "down" : "flat",
      monthlyPrice: monthlyPrices,
      monthlyQty: monthlyQtys,
      monthlyQuantity: g.totalQuantity,
      monthlySpent: g.totalSpent,
      purchaseCount: g.purchaseCount,
      unit: g.unit,
    };
  });

  const suggestions: SuggestionData[] = products
    .filter((p) => p.monthlyQuantity > 6 && p.latestPrice > 0)
    .slice(0, 5)
    .map((p) => {
      const bulkDiscount = 0.8;
      const bulkUnitPrice = p.latestPrice * bulkDiscount;
      const monthlyQty = Math.max(1, p.monthlyQuantity);
      const savingMonthly = (p.latestPrice - bulkUnitPrice) * monthlyQty;
      return {
        id: `sug-${p.id}`,
        productId: p.id,
        title: p.name,
        description: t("bulkCardDescription", {
          count: Number(monthlyQty.toFixed(1)),
        }),
        savingMonthly: Math.max(0, savingMonthly),
        currentUnitPrice: p.latestPrice,
        bulkUnitPrice,
        packQuantity: Math.max(6, Math.ceil(monthlyQty)),
      };
    });

  const data: DashboardViewData = {
    totalSpentMonth: statsResult.stats.totalSpent,
    uniqueProductsMonth: products.length,
    weekSpend,
    months,
    products,
    suggestions,
  };

  const manualEntries = recentReceipts.receipts.map((receipt) => ({
    id: receipt.id,
    date: receipt.date.toISOString(),
    totalAmount: receipt.totalAmount,
    currency: receipt.currency,
    items: receipt.items.map((item) => ({
      id: item.id,
      rawName: item.rawName,
      normalizedName: item.normalizedName,
      category: item.category,
      quantity: item.quantity,
      unit: normalizeItemUnit(item.unit),
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
  }));

  return (
    <HackathonDashboard
      data={data}
      normalizedNameOptions={normalizedNames.normalizedNames}
      manualEntries={manualEntries}
    />
  );
}

function buildWeeklySpend(
  receipts: Array<{ date: Date; totalAmount: number }>,
  now: Date
): WeeklySpendData[] {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const weeks: WeeklySpendData[] = [];

  for (let w = 0; w < 5; w++) {
    const start = new Date(firstDay);
    start.setDate(start.getDate() + w * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const total = receipts
      .filter((r) => {
        const d = new Date(r.date);
        return d >= start && d < end;
      })
      .reduce((sum, r) => sum + r.totalAmount, 0);

    weeks.push({ label: `S${w + 1}`, total });
  }

  return weeks;
}

type ItemLike = {
  unitPrice: number;
  quantity: number;
  receiptId: string;
  unit: ItemUnit;
};
type ReceiptLike = { id: string; date: Date };

function buildMonthlyValues(
  items: ItemLike[],
  receipts: ReceiptLike[],
  now: Date,
  mode: "price" | "qty"
): number[] {
  const receiptDateMap = new Map<string, Date>();
  for (const r of receipts) {
    receiptDateMap.set(r.id, new Date(r.date));
  }

  const values: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const monthItems = items.filter((item) => {
      const d = receiptDateMap.get(item.receiptId);
      return d && d >= monthStart && d <= monthEnd;
    });

    if (mode === "price") {
      const prices = monthItems.map((i) => i.unitPrice).filter((p) => p > 0);
      values.push(prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0);
    } else {
      values.push(monthItems.reduce((sum, i) => sum + i.quantity, 0));
    }
  }

  return values;
}
