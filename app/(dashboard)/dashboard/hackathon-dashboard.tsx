"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ReceiptMagicUpload } from "@/components/receipt-magic-upload";
import { AreaChart } from "@/components/AreaChart";
import {
  DEFAULT_ITEM_UNIT,
  getItemUnitShortLabel,
  type ItemUnit,
} from "@/lib/item-units";

type TrendDirection = "up" | "down" | "flat";

export type ProductCardData = {
  id: string;
  name: string;
  category: string;
  color: string;
  latestPrice: number;
  trendPct: number;
  trendDirection: TrendDirection;
  monthlyPrice: number[];
  monthlyQty: number[];
  monthlyQuantity: number;
  monthlySpent: number;
  purchaseCount: number;
  unit: ItemUnit;
};

export type SuggestionData = {
  id: string;
  productId: string;
  title: string;
  description: string;
  savingMonthly: number;
  currentUnitPrice: number;
  bulkUnitPrice: number;
  packQuantity: number;
};

export type WeeklySpendData = {
  label: string;
  total: number;
};

export type DashboardViewData = {
  totalSpentMonth: number;
  uniqueProductsMonth: number;
  weekSpend: WeeklySpendData[];
  months: string[];
  products: ProductCardData[];
  suggestions: SuggestionData[];
};

type DashboardProps = {
  data: DashboardViewData;
  normalizedNameOptions: string[];
  manualEntries: Array<{
    id: string;
    date: string;
    totalAmount: number;
    currency: string;
    items: Array<{
      id: string;
      rawName: string;
      normalizedName: string;
      category: string;
      quantity: number;
      unit: ItemUnit;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
};

const trendLabel = (value: number, localeTag: string) => {
  const abs = Math.abs(value);
  if (abs < 0.1) return "=";
  const prefix = value > 0 ? "+" : "-";
  const formatted = new Intl.NumberFormat(localeTag, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(abs);
  return `${prefix}${formatted}%`;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Grãos": "#007aff",
  "Laticínios": "#ff3b30",
  "Bebidas": "#ff9500",
  "Limpeza": "#34c759",
  "Higiene": "#af52de",
};

export default function HackathonDashboard({
  data,
  normalizedNameOptions,
  manualEntries,
}: DashboardProps) {
  const t = useTranslations("DashboardRules");
  const locale = useLocale();
  const localeTag = locale === "pt" ? "pt-BR" : "en-US";
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeProductId, setActiveProductId] = useState<string>(data.products[0]?.id ?? "");
  const [metric, setMetric] = useState<"price" | "qty">("price");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set());
  const [suggestionActions, setSuggestionActions] = useState<Record<string, "plan" | "bought">>({});
  const [expandedSug, setExpandedSug] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(data.products.map((p) => p.category)));
    return ["all", ...unique];
  }, [data.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => {
      const catMatch = activeCategory === "all" || p.category === activeCategory;
      const searchMatch = q.length === 0 || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [activeCategory, data.products, search]);

  const selectedProduct = data.products.find((p) => p.id === activeProductId) ?? filteredProducts[0] ?? data.products[0];
  const selectedUnitLabel = getItemUnitShortLabel(
    selectedProduct?.unit ?? DEFAULT_ITEM_UNIT,
    locale
  );

  const productById = useMemo(
    () => new Map(data.products.map((product) => [product.id, product])),
    [data.products]
  );

  const remainingSuggestions = data.suggestions.filter((s) => !dismissedSuggestions.has(s.id));
  const remainingSavings = remainingSuggestions.reduce((acc, s) => acc + s.savingMonthly, 0);
  const potentialSavingsMonth = remainingSavings;
  const potentialSavingsYear = potentialSavingsMonth * 12;
  const lowVolumeProducts = useMemo(
    () =>
      data.products
        .filter((p) => p.monthlyQuantity <= 6)
        .sort((a, b) => b.monthlyQuantity - a.monthlyQuantity)
        .slice(0, 3),
    [data.products]
  );

  const chartValues = useMemo(() => {
    return metric === "price" ? selectedProduct?.monthlyPrice ?? [] : selectedProduct?.monthlyQty ?? [];
  }, [metric, selectedProduct?.monthlyPrice, selectedProduct?.monthlyQty]);

  const chartCategory =
    metric === "price"
      ? t("chartCategoryPrice")
      : t("chartCategoryQuantity", { unitLabel: selectedUnitLabel });
  const chartData = useMemo(() => {
    return data.months.map((month, index) => ({
      month,
      [chartCategory]: chartValues[index] ?? 0,
    }));
  }, [chartCategory, chartValues, data.months]);
  const applySuggestionAction = (suggestionId: string, action: "plan" | "bought") => {
    setSuggestionActions((prev) => ({ ...prev, [suggestionId]: action }));
    setDismissedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(suggestionId);
      return next;
    });
    setExpandedSug(null);
  };
  const actionValues = Object.values(suggestionActions);
  const handledPlanCount = actionValues.filter((value) => value === "plan").length;
  const handledBoughtCount = actionValues.filter((value) => value === "bought").length;
  const formatCurrency = (value: number) =>
    value.toLocaleString(localeTag, {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });

  const formatCompactCurrency = (value: number) =>
    value.toLocaleString(localeTag, {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      {/* ── AI CARD — full width, last row ── */}
      <div className="col-span-full">
        <div className="relative overflow-hidden rounded-[24px] border border-[rgba(0,122,255,0.13)] bg-[linear-gradient(145deg,rgba(0,122,255,0.048)_0%,rgba(52,199,89,0.035)_100%)] p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="pointer-events-none absolute -top-[50px] -right-[50px] h-[150px] w-[150px] rounded-full bg-[radial-gradient(circle,rgba(0,122,255,0.07)_0%,transparent_70%)]" />

          <div className="mb-1 flex items-center gap-1.5">
            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-linear-to-br from-notia-accent to-notia-green text-[9px] font-black text-white shadow-[0_2px_5px_rgba(0,122,255,0.28)]">N</div>
            <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-notia-accent">{t("aiLabel")}</span>
          </div>

          <div className="animate-fade-up">
              {/* Hero economy number */}
              <div className="my-3.5 flex items-center justify-between gap-3 rounded-[16px] border border-[rgba(52,199,89,0.2)] bg-[linear-gradient(135deg,rgba(52,199,89,0.1),rgba(0,122,255,0.07))] p-[16px_18px]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("aiPotentialSavingsLabel")}</p>
                  <p className="text-[32px] font-black leading-none tracking-[-1.5px] text-notia-green">{formatCompactCurrency(remainingSavings)}{t("perMonthSuffix")}</p>
                  <p className="mt-[3px] text-[12px] text-notia-text-muted">{t("aiAdjustmentsCount", { count: remainingSuggestions.length })}</p>
                </div>
                <div className="shrink-0 rounded-[10px] bg-[rgba(52,199,89,0.1)] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold text-notia-text-muted">{t("perYearLabel")}</p>
                  <p className="text-[17px] font-black tracking-[-0.6px] text-notia-green">{formatCompactCurrency(remainingSavings * 12)}</p>
                </div>
              </div>

              {/* Suggestion cards */}
              {remainingSuggestions.length === 0 ? (
                <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-white p-[14px_16px]">
                  <p className="text-[13px] font-bold text-notia-text">
                    {data.suggestions.length === 0
                      ? t("noRecommendationTitle")
                      : t("allRecommendationsHandledTitle")}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-notia-text-secondary">
                    {data.suggestions.length === 0
                      ? t("noRecommendationBody", { minCount: 7 })
                      : t("allRecommendationsHandledBody")}
                  </p>
                  {data.suggestions.length > 0 && (
                    <p className="mt-1 text-[11px] text-notia-text-muted">
                      {t("allRecommendationsHandledMeta", {
                        planCount: handledPlanCount,
                        boughtCount: handledBoughtCount,
                      })}
                    </p>
                  )}

                  {data.suggestions.length === 0 && lowVolumeProducts.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {lowVolumeProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="font-semibold text-notia-text">{product.name}</span>
                          <span className="text-notia-text-muted">
                            {t("noRecommendationCount", {
                              count: Number(product.monthlyQuantity.toFixed(1)),
                              unitLabel: getItemUnitShortLabel(product.unit, locale),
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {remainingSuggestions.map((sug) => {
                    const isExpanded = expandedSug === sug.id;
                    const badgeClass = sug.savingMonthly > 30 ? "bg-notia-red-dim" : sug.savingMonthly > 15 ? "bg-notia-orange-dim" : "bg-notia-green-dim";
                    const emoji = sug.savingMonthly > 30 ? "⚠️" : sug.savingMonthly > 15 ? "💡" : "📦";
                    const sourceProduct = productById.get(sug.productId);
                    const itemCount = sourceProduct?.monthlyQuantity ?? 0;
                    const avgRetail = sourceProduct?.latestPrice ?? sug.currentUnitPrice;
                    const unitLabel = getItemUnitShortLabel(
                      sourceProduct?.unit ?? DEFAULT_ITEM_UNIT,
                      locale
                    );
                    const monthlyQty = Math.max(1, sourceProduct?.monthlyQuantity ?? sug.packQuantity);
                    const qtyFormatted = new Intl.NumberFormat(undefined, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(monthlyQty);
                    const suggestionInsight = t("insightWholesale", {
                      monthlyQty: qtyFormatted,
                      unitLabel,
                      packQty: sug.packQuantity,
                      packPrice: formatCurrency(
                        sug.bulkUnitPrice * sug.packQuantity
                      ),
                      bulkUnitPrice: formatCurrency(sug.bulkUnitPrice),
                      monthlySaving: formatCurrency(sug.savingMonthly),
                      yearlySaving: formatCurrency(sug.savingMonthly * 12),
                    });

                    return (
                      <div key={sug.id} className="overflow-hidden rounded-[16px] border border-[rgba(0,0,0,0.055)] bg-[rgba(255,255,255,0.72)] transition hover:shadow-[0_3px_12px_rgba(0,0,0,0.08)]">
                        <button
                          type="button"
                          onClick={() => setExpandedSug(isExpanded ? null : sug.id)}
                          className="flex w-full items-center gap-[11px] p-[12px_14px] text-left"
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[14px] ${badgeClass}`}>{emoji}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-bold text-notia-text">{sug.title}</p>
                            <p className="text-[11px] text-notia-text-muted">{sug.description}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[14px] font-black tracking-[-0.4px] text-notia-green">-{formatCurrency(sug.savingMonthly).replace("R$\u00a0", "R$ ")}</p>
                            <p className="text-[10px] text-notia-text-muted">{t("perMonthLabel")}</p>
                          </div>
                          <span className={`shrink-0 text-[12px] text-notia-text-muted transition ${isExpanded ? "rotate-180" : ""}`}>&#8964;</span>
                        </button>

                        {isExpanded && (
                          <div className="animate-fade-up border-t border-[rgba(0,0,0,0.07)] px-3.5 pb-3.5">
                            <div className="my-3 flex gap-2">
                              <div className="flex-1 rounded-[10px] border border-[rgba(255,59,48,0.15)] bg-notia-red-dim p-[10px_12px] text-center">
                                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-red">{t("todayLabel")}</p>
                                <p className="text-[17px] font-black tracking-[-0.5px] text-notia-red">{formatCurrency(sug.currentUnitPrice)}</p>
                                <p className="mt-0.5 text-[10px] text-notia-text-muted">{t("perUnitRetailLabel")}</p>
                              </div>
                              <div className="flex items-center pt-2.5 text-[16px] text-notia-text-muted">→</div>
                              <div className="flex-1 rounded-[10px] border border-[rgba(52,199,89,0.2)] bg-notia-green-dim p-[10px_12px] text-center">
                                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-green">{t("wholesaleLabel")}</p>
                                <p className="text-[17px] font-black tracking-[-0.5px] text-notia-green">{formatCurrency(sug.bulkUnitPrice)}</p>
                                <p className="mt-0.5 text-[10px] text-notia-text-muted">{t("perUnitPackLabel", { packQty: sug.packQuantity })}</p>
                              </div>
                            </div>

                            <p className="mb-2 text-[12px] leading-relaxed text-notia-text-secondary">{suggestionInsight}</p>
                            <p className="mb-3 rounded-[8px] border border-[rgba(0,0,0,0.07)] bg-notia-bg px-2.5 py-1.5 text-[11px] text-notia-text-muted">
                              {t("trustSignal", {
                                count: Number(itemCount.toFixed(1)),
                                avgRetail: formatCurrency(avgRetail),
                                unitLabel,
                              })}
                            </p>

                    
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Remaining total */}
              <div className="mt-2.5 flex items-center justify-between border-t border-[rgba(0,0,0,0.07)] pt-2.5 text-[12px]">
                <span className="text-notia-text-muted">{t("remainingSavingsLabel")}</span>
                <span className="text-[14px] font-black tracking-[-0.4px] text-notia-green">{formatCompactCurrency(remainingSavings)}{t("perMonthSuffix")}</span>
              </div>
          </div>
        </div>
      </div>
      {/* ── KPI ROW ── */}
      <div className="col-span-full">
        <div className="grid grid-cols-1 gap-3">
   

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-white p-[18px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
              <div className="absolute -top-5 -right-5 h-[90px] w-[90px] rounded-full bg-[radial-gradient(circle_at_100%_0%,rgba(0,122,255,0.09)_0%,transparent_68%)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("kpiTotalSpentTitle")}</p>
              <p className="mt-2 text-[clamp(22px,3vw,28px)] font-black tracking-[-1px] text-notia-accent">{formatCurrency(data.totalSpentMonth)}</p>
              <p className="text-[11px] text-notia-text-muted">{t("kpiCurrentMonthSubtitle")}</p>
            </div>
            <div className="relative overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-white p-[18px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
              <div className="absolute -top-5 -right-5 h-[90px] w-[90px] rounded-full bg-[radial-gradient(circle_at_100%_0%,rgba(52,199,89,0.11)_0%,transparent_68%)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("kpiProductsTrackedTitle")}</p>
              <p className="mt-2 text-[clamp(22px,3vw,28px)] font-black tracking-[-1px] text-notia-green">{data.uniqueProductsMonth}</p>
              <p className="text-[11px] text-notia-text-muted">{t("kpiUniqueItemsSubtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── UPLOAD — full width row ── */}
      <div className="col-span-full">
        <ReceiptMagicUpload
          redirectToDashboard
          normalizedNameOptions={normalizedNameOptions}
          manualEntries={manualEntries}
          manualSecondary
        />
      </div>

      {/* ── LEFT COLUMN: Product List ── */}
      <div className="flex flex-col gap-3.5">
        <div className="rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_3px_10px_rgba(0,0,0,0.025)]">
          <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("productsTitle")}</p>

          <div className="mb-2.5 flex items-center gap-2 rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg px-3 py-2">
            <span className="text-[14px] text-notia-text-muted">&#8981;</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 border-none bg-transparent text-[13px] text-notia-text outline-none placeholder:text-notia-text-muted"
            />
          </div>

          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-[14px] px-[11px] py-1 text-[11px] font-semibold transition ${isActive
                      ? "bg-notia-accent border-notia-accent text-white"
                      : "border border-[rgba(0,0,0,0.07)] bg-notia-bg text-notia-text-muted hover:text-notia-text"
                    }`}
                >
                  {cat === "all" ? t("allCategory") : cat}
                </button>
              );
            })}
          </div>

          <div className="max-h-[290px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.1) transparent" }}>
            {filteredProducts.length === 0 && (
              <div className="py-7 text-center text-[13px] text-notia-text-muted">{t("noProductsFound")}</div>
            )}
            {filteredProducts.map((product) => {
              const isActive = selectedProduct?.id === product.id;
              const trendClass = product.trendDirection === "up" ? "text-notia-red" : product.trendDirection === "down" ? "text-notia-green" : "text-notia-text-muted";
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setActiveProductId(product.id)}
                  className={`mb-px flex w-full items-center gap-[11px] rounded-[10px] border-[1.5px] px-[10px] py-[9px] text-left transition ${isActive
                      ? "border-[rgba(0,122,255,0.14)] bg-[rgba(0,122,255,0.055)]"
                      : "border-transparent hover:bg-[rgba(0,0,0,0.03)]"
                    }`}
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: product.color || CATEGORY_COLORS[product.category] || "#007aff" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-notia-text">{product.name}</span>
                    <span className="block text-[11px] text-notia-text-muted">
                      {product.category} · {getItemUnitShortLabel(product.unit, locale)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-notia-text">{formatCurrency(product.latestPrice)}</span>
                  <span className={`w-[38px] shrink-0 text-right text-[11px] font-bold ${trendClass}`}>{trendLabel(product.trendPct, localeTag)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Chart + Insight ── */}
      <div className="flex flex-col gap-3.5">
        <div className="rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_3px_10px_rgba(0,0,0,0.025)]">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2.5">
            <div>
              <p className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">{t("productHistoryTitle")}</p>
              <p className="mb-[5px] text-[16px] font-extrabold tracking-[-0.4px]">{selectedProduct?.name ?? t("noData")}</p>
         
            </div>
            <div className="flex rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-notia-bg p-[3px]">
              <button type="button" onClick={() => setMetric("price")} className={`rounded-[16px] px-[13px] py-[5px] text-[12px] font-medium transition ${metric === "price" ? "bg-white font-bold text-notia-text shadow-[0_1px_4px_rgba(0,0,0,0.09)]" : "text-notia-text-muted"}`}>{t("metricPrice")}</button>
              <button type="button" onClick={() => setMetric("qty")} className={`rounded-[16px] px-[13px] py-[5px] text-[12px] font-medium transition ${metric === "qty" ? "bg-white font-bold text-notia-text shadow-[0_1px_4px_rgba(0,0,0,0.09)]" : "text-notia-text-muted"}`}>{t("metricQty")}</button>
            </div>
          </div>

          <div className="my-3.5">
            <AreaChart
              className="h-[210px]"
              data={chartData}
              index="month"
              categories={[chartCategory]}
              colors={["blue"]}
              showLegend={false}
              showGridLines
              showTooltip
              showXAxis
              showYAxis
              yAxisWidth={96}
              fill="gradient"
              valueFormatter={(value) =>
                metric === "price"
                  ? formatCurrency(value)
                  : `${new Intl.NumberFormat(localeTag, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(value)} ${selectedUnitLabel}`
              }
            />
          </div>

          <div className="flex flex-wrap gap-5 border-t border-[rgba(0,0,0,0.07)] pt-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("latestPriceLabel")}</p>
              <p className="text-[15px] font-extrabold tracking-[-0.4px]">{formatCurrency(selectedProduct?.latestPrice ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("variation6mLabel")}</p>
              <p className={`text-[15px] font-extrabold tracking-[-0.4px] ${(selectedProduct?.trendPct ?? 0) > 0 ? "text-notia-red" : "text-notia-green"}`}>{trendLabel(selectedProduct?.trendPct ?? 0, localeTag)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">{t("quantityLabel")}</p>
              <p className="text-[15px] font-extrabold tracking-[-0.4px]">
                {new Intl.NumberFormat(localeTag, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(selectedProduct?.monthlyQuantity ?? 0)} {selectedUnitLabel}
              </p>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
