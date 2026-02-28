"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ReceiptMagicUpload } from "@/components/receipt-magic-upload";
import { AreaChart } from "@/components/AreaChart";

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
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
};

const trendLabel = (value: number) => {
  const abs = Math.abs(value);
  if (abs < 0.1) return "=";
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${abs.toFixed(1).replace(".", ",")}%`;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const formatCompactCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeProductId, setActiveProductId] = useState<string>(data.products[0]?.id ?? "");
  const [metric, setMetric] = useState<"price" | "qty">("price");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set());
  const [aiState, setAiState] = useState<"idle" | "processing" | "result">("idle");
  const [procStep, setProcStep] = useState(0);
  const [procProgress, setProcProgress] = useState(0);
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

  const selectedSuggestion = data.suggestions.find((s) => s.productId === selectedProduct?.id);

  const remainingSuggestions = data.suggestions.filter((s) => !dismissedSuggestions.has(s.id));
  const remainingSavings = remainingSuggestions.reduce((acc, s) => acc + s.savingMonthly, 0);

  const chartValues = useMemo(() => {
    return metric === "price" ? selectedProduct?.monthlyPrice ?? [] : selectedProduct?.monthlyQty ?? [];
  }, [metric, selectedProduct?.monthlyPrice, selectedProduct?.monthlyQty]);

  const chartCategory = metric === "price" ? "Preço" : "Quantidade";
  const chartData = useMemo(() => {
    return data.months.map((month, index) => ({
      month,
      [chartCategory]: chartValues[index] ?? 0,
    }));
  }, [chartCategory, chartValues, data.months]);


  const insightText = useMemo(() => {
    if (!selectedProduct) {
      return t("insightNoData");
    }

    if (selectedProduct.purchaseCount <= 6) {
      return t("insightNeedsVolume", { count: selectedProduct.purchaseCount });
    }

    const monthlyQty = Math.max(1, selectedProduct.monthlyQuantity);
    const qtyFormatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(monthlyQty);

    if (!selectedSuggestion) {
      const retailUnit = selectedProduct.latestPrice || selectedProduct.monthlySpent;
      const bulkUnit = retailUnit * 0.8;
      const packQty = Math.max(6, Math.ceil(monthlyQty));
      const monthlySaving = Math.max(0, (retailUnit - bulkUnit) * monthlyQty);

      return t("insightWholesale", {
        monthlyQty: qtyFormatted,
        packQty,
        packPrice: formatCurrency(bulkUnit * packQty),
        bulkUnitPrice: formatCurrency(bulkUnit),
        monthlySaving: formatCurrency(monthlySaving),
        yearlySaving: formatCurrency(monthlySaving * 12),
      });
    }

    const monthlySaving = selectedSuggestion.savingMonthly;
    return t("insightWholesale", {
      monthlyQty: qtyFormatted,
      packQty: selectedSuggestion.packQuantity,
      packPrice: formatCurrency(
        selectedSuggestion.bulkUnitPrice * selectedSuggestion.packQuantity
      ),
      bulkUnitPrice: formatCurrency(selectedSuggestion.bulkUnitPrice),
      monthlySaving: formatCurrency(monthlySaving),
      yearlySaving: formatCurrency(monthlySaving * 12),
    });
  }, [selectedProduct, selectedSuggestion, t]);

  const startAI = () => {
    setAiState("processing");
    setProcStep(0);
    setProcProgress(0);
    const steps = ["Lendo histórico de compras…", "Identificando padrões de consumo…", "Comparando preços por volume…", "Calculando economia potencial…", "Gerando sugestões…"];
    let i = 0;
    const iv = setInterval(() => {
      if (i < steps.length) {
        setProcStep(i);
        setProcProgress(((i + 1) / steps.length) * 100);
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => setAiState("result"), 400);
      }
    }, 650);
  };

  const resetAI = () => {
    setDismissedSuggestions(new Set());
    setExpandedSug(null);
    setAiState("idle");
  };

  const procSteps = ["Lendo histórico de compras…", "Identificando padrões de consumo…", "Comparando preços por volume…", "Calculando economia potencial…", "Gerando sugestões…"];

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">

      {/* ── KPI ROW ── */}
      <div className="col-span-full">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-white p-[18px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
            <div className="absolute -top-5 -right-5 h-[90px] w-[90px] rounded-full bg-[radial-gradient(circle_at_100%_0%,rgba(0,122,255,0.09)_0%,transparent_68%)]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">Total gasto</p>
            <p className="mt-2 text-[clamp(22px,3vw,28px)] font-black tracking-[-1px] text-notia-accent">{formatCurrency(data.totalSpentMonth)}</p>
            <p className="text-[11px] text-notia-text-muted">mês atual</p>
          </div>
          <div className="relative overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-white p-[18px_20px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
            <div className="absolute -top-5 -right-5 h-[90px] w-[90px] rounded-full bg-[radial-gradient(circle_at_100%_0%,rgba(52,199,89,0.11)_0%,transparent_68%)]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">Produtos cadastrados</p>
            <p className="mt-2 text-[clamp(22px,3vw,28px)] font-black tracking-[-1px] text-notia-green">{data.uniqueProductsMonth}</p>
            <p className="text-[11px] text-notia-text-muted">itens únicos identificados</p>
          </div>
        </div>
      </div>

      {/* ── UPLOAD — full width row ── */}
      <div className="col-span-full">
        <ReceiptMagicUpload
          redirectToDashboard
          normalizedNameOptions={normalizedNameOptions}
          manualEntries={manualEntries}
        />
      </div>

      {/* ── LEFT COLUMN: Product List ── */}
      <div className="flex flex-col gap-3.5">
        <div className="rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_3px_10px_rgba(0,0,0,0.025)]">
          <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">Produtos</p>

          <div className="mb-2.5 flex items-center gap-2 rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg px-3 py-2">
            <span className="text-[14px] text-notia-text-muted">&#8981;</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto ou categoria…"
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
                  className={`rounded-[14px] px-[11px] py-1 text-[11px] font-semibold transition ${
                    isActive
                      ? "bg-notia-accent border-notia-accent text-white"
                      : "border border-[rgba(0,0,0,0.07)] bg-notia-bg text-notia-text-muted hover:text-notia-text"
                  }`}
                >
                  {cat === "all" ? "Todos" : cat}
                </button>
              );
            })}
          </div>

          <div className="max-h-[290px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.1) transparent" }}>
            {filteredProducts.length === 0 && (
              <div className="py-7 text-center text-[13px] text-notia-text-muted">Nenhum produto encontrado</div>
            )}
            {filteredProducts.map((product) => {
              const isActive = selectedProduct?.id === product.id;
              const trendClass = product.trendDirection === "up" ? "text-notia-red" : product.trendDirection === "down" ? "text-notia-green" : "text-notia-text-muted";
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setActiveProductId(product.id)}
                  className={`mb-px flex w-full items-center gap-[11px] rounded-[10px] border-[1.5px] px-[10px] py-[9px] text-left transition ${
                    isActive
                      ? "border-[rgba(0,122,255,0.14)] bg-[rgba(0,122,255,0.055)]"
                      : "border-transparent hover:bg-[rgba(0,0,0,0.03)]"
                  }`}
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: product.color || CATEGORY_COLORS[product.category] || "#007aff" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-notia-text">{product.name}</span>
                    <span className="block text-[11px] text-notia-text-muted">{product.category}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-notia-text">{formatCurrency(product.latestPrice)}</span>
                  <span className={`w-[38px] shrink-0 text-right text-[11px] font-bold ${trendClass}`}>{trendLabel(product.trendPct)}</span>
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
              <p className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">Histórico do produto</p>
              <p className="mb-[5px] text-[16px] font-extrabold tracking-[-0.4px]">{selectedProduct?.name ?? "Sem dados"}</p>
              <span className="inline-block rounded-[6px] bg-notia-accent-dim px-2 py-0.5 text-[11px] font-bold text-notia-accent">{selectedProduct?.category ?? "-"}</span>
            </div>
            <div className="flex rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-notia-bg p-[3px]">
              <button type="button" onClick={() => setMetric("price")} className={`rounded-[16px] px-[13px] py-[5px] text-[12px] font-medium transition ${metric === "price" ? "bg-white font-bold text-notia-text shadow-[0_1px_4px_rgba(0,0,0,0.09)]" : "text-notia-text-muted"}`}>Preço</button>
              <button type="button" onClick={() => setMetric("qty")} className={`rounded-[16px] px-[13px] py-[5px] text-[12px] font-medium transition ${metric === "qty" ? "bg-white font-bold text-notia-text shadow-[0_1px_4px_rgba(0,0,0,0.09)]" : "text-notia-text-muted"}`}>Qtd</button>
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
              yAxisWidth={48}
              fill="gradient"
              valueFormatter={(value) =>
                metric === "price"
                  ? formatCurrency(value)
                  : `${value.toFixed(1).replace(".", ",")} un`
              }
            />
          </div>

          <div className="flex flex-wrap gap-5 border-t border-[rgba(0,0,0,0.07)] pt-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">Último preço</p>
              <p className="text-[15px] font-extrabold tracking-[-0.4px]">{formatCurrency(selectedProduct?.latestPrice ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">Variação 6m</p>
              <p className={`text-[15px] font-extrabold tracking-[-0.4px] ${(selectedProduct?.trendPct ?? 0) > 0 ? "text-notia-red" : "text-notia-green"}`}>{trendLabel(selectedProduct?.trendPct ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-text-muted">Comprado</p>
              <p className="text-[15px] font-extrabold tracking-[-0.4px]">{selectedProduct?.purchaseCount ?? 0}x / mês</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI CARD — full width, last row ── */}
      <div className="col-span-full">
        <div className="relative overflow-hidden rounded-[24px] border border-[rgba(0,122,255,0.13)] bg-[linear-gradient(145deg,rgba(0,122,255,0.048)_0%,rgba(52,199,89,0.035)_100%)] p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="pointer-events-none absolute -top-[50px] -right-[50px] h-[150px] w-[150px] rounded-full bg-[radial-gradient(circle,rgba(0,122,255,0.07)_0%,transparent_70%)]" />

          <div className="mb-1 flex items-center gap-1.5">
            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-linear-to-br from-notia-accent to-notia-green text-[9px] font-black text-white shadow-[0_2px_5px_rgba(0,122,255,0.28)]">N</div>
            <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-notia-accent">Notia AI</span>
          </div>

          {/* STATE: idle */}
          {aiState === "idle" && (
            <div className="animate-fade-up">
              <div className="my-3.5 rounded-[16px] border border-[rgba(0,0,0,0.055)] bg-[rgba(255,255,255,0.6)] p-[16px_18px]">
                <span className="block text-[22px] font-black tracking-[-0.8px] text-notia-accent">{formatCurrency(data.totalSpentMonth)}</span>
                <p className="text-[13px] leading-relaxed text-notia-text-secondary">
                  gastos no mês. <strong className="font-bold text-notia-text">Posso identificar onde você está pagando mais do que deveria</strong> comprando em quantidade menor.
                </p>
              </div>
              <button
                type="button"
                onClick={startAI}
                className="flex w-full items-center justify-center gap-[7px] rounded-[16px] bg-notia-accent px-3.5 py-3.5 text-[14px] font-extrabold tracking-[-0.2px] text-white shadow-[0_3px_12px_rgba(0,122,255,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_20px_rgba(0,122,255,0.44)] active:translate-y-0"
              >
                <span className="text-[12px]">&#10022;</span>
                Analisar meus gastos agora
              </button>
            </div>
          )}

          {/* STATE: processing */}
          {aiState === "processing" && (
            <div className="animate-fade-up flex flex-col items-center gap-3 py-5">
              <div className="relative h-16 w-16">
                <svg width="64" height="64" className="animate-spin-slow">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,122,255,0.12)" strokeWidth="3" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke="url(#sg)" strokeWidth="3" strokeDasharray="50 115" strokeLinecap="round" />
                  <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#007aff" /><stop offset="100%" stopColor="#34c759" /></linearGradient></defs>
                </svg>
                <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[12px] border border-[rgba(0,122,255,0.2)] bg-[linear-gradient(135deg,rgba(0,122,255,0.12),rgba(52,199,89,0.1))] text-[15px]">&#10022;</div>
              </div>
              <p className="text-[15px] font-extrabold tracking-[-0.3px]">Analisando seus dados…</p>
              <p className="min-h-[18px] text-center text-[12px] text-notia-text-muted">{procSteps[procStep]}</p>
              <div className="h-1 w-full overflow-hidden rounded-[6px] bg-notia-bg">
                <div className="h-full rounded-[6px] bg-linear-to-r from-notia-accent to-notia-green transition-[width] duration-500 ease-out" style={{ width: `${procProgress}%` }} />
              </div>
            </div>
          )}

          {/* STATE: result */}
          {aiState === "result" && (
            <div className="animate-fade-up">
              {/* Hero economy number */}
              <div className="my-3.5 flex items-center justify-between gap-3 rounded-[16px] border border-[rgba(52,199,89,0.2)] bg-[linear-gradient(135deg,rgba(52,199,89,0.1),rgba(0,122,255,0.07))] p-[16px_18px]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">Economia potencial</p>
                  <p className="text-[32px] font-black leading-none tracking-[-1.5px] text-notia-green">{formatCompactCurrency(remainingSavings)}/mês</p>
                  <p className="mt-[3px] text-[12px] text-notia-text-muted">com {remainingSuggestions.length} ajustes de compra</p>
                </div>
                <div className="shrink-0 rounded-[10px] bg-[rgba(52,199,89,0.1)] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold text-notia-text-muted">por ano</p>
                  <p className="text-[17px] font-black tracking-[-0.6px] text-notia-green">{formatCompactCurrency(remainingSavings * 12)}</p>
                </div>
              </div>

              {/* Suggestion cards */}
              <div className="flex flex-col gap-2">
                {data.suggestions.map((sug) => {
                  const isDismissed = dismissedSuggestions.has(sug.id);
                  const isExpanded = expandedSug === sug.id;
                  const badgeClass = sug.savingMonthly > 30 ? "bg-notia-red-dim" : sug.savingMonthly > 15 ? "bg-notia-orange-dim" : "bg-notia-green-dim";
                  const emoji = sug.savingMonthly > 30 ? "⚠️" : sug.savingMonthly > 15 ? "💡" : "📦";

                  return (
                    <div key={sug.id} className={`overflow-hidden rounded-[16px] border border-[rgba(0,0,0,0.055)] bg-[rgba(255,255,255,0.72)] transition ${isDismissed ? "pointer-events-none opacity-40" : "hover:shadow-[0_3px_12px_rgba(0,0,0,0.08)]"}`}>
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
                          <p className="text-[10px] text-notia-text-muted">por mês</p>
                        </div>
                        <span className={`shrink-0 text-[12px] text-notia-text-muted transition ${isExpanded ? "rotate-180" : ""}`}>&#8964;</span>
                      </button>

                      {isExpanded && (
                        <div className="animate-fade-up border-t border-[rgba(0,0,0,0.07)] px-3.5 pb-3.5">
                          <div className="my-3 flex gap-2">
                            <div className="flex-1 rounded-[10px] border border-[rgba(255,59,48,0.15)] bg-notia-red-dim p-[10px_12px] text-center">
                              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-red">Hoje</p>
                              <p className="text-[17px] font-black tracking-[-0.5px] text-notia-red">{formatCurrency(sug.currentUnitPrice)}</p>
                              <p className="mt-0.5 text-[10px] text-notia-text-muted">por unidade (varejo)</p>
                            </div>
                            <div className="flex items-center pt-2.5 text-[16px] text-notia-text-muted">→</div>
                            <div className="flex-1 rounded-[10px] border border-[rgba(52,199,89,0.2)] bg-notia-green-dim p-[10px_12px] text-center">
                              <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-notia-green">Atacado</p>
                              <p className="text-[17px] font-black tracking-[-0.5px] text-notia-green">{formatCurrency(sug.bulkUnitPrice)}</p>
                              <p className="mt-0.5 text-[10px] text-notia-text-muted">por unidade (fardo {sug.packQuantity}un)</p>
                            </div>
                          </div>

                          <p className="mb-3 text-[12px] leading-relaxed text-notia-text-secondary">{insightText}</p>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setDismissedSuggestions((s) => { const n = new Set(s); n.add(sug.id); return n; }); setExpandedSug(null); }}
                              className="flex flex-1 items-center justify-center gap-1 rounded-[10px] bg-notia-green border border-notia-green px-2 py-[9px] text-[12px] font-bold text-white shadow-[0_2px_6px_rgba(52,199,89,0.25)]"
                            >
                              &#10003; Vou fazer isso
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDismissedSuggestions((s) => { const n = new Set(s); n.add(sug.id); return n; }); setExpandedSug(null); }}
                              className="rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-transparent px-3 py-[9px] text-[12px] font-semibold text-notia-text-muted hover:bg-[rgba(0,0,0,0.03)]"
                            >
                              Ignorar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Remaining total */}
              <div className="mt-2.5 flex items-center justify-between border-t border-[rgba(0,0,0,0.07)] pt-2.5 text-[12px]">
                <span className="text-notia-text-muted">Economia restante disponível</span>
                <span className="text-[14px] font-black tracking-[-0.4px] text-notia-green">{formatCompactCurrency(remainingSavings)}/mês</span>
              </div>

              <button type="button" onClick={resetAI} className="mt-2.5 inline-block text-[11px] text-notia-text-muted underline hover:text-notia-accent">
                &#8617; Refazer análise
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
