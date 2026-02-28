"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  cancelReceiptProcessing,
  syncReceiptProcessingStatuses,
  submitReceiptForProcessing,
  type UploadReceiptState,
} from "@/lib/actions/process";
import { normalizeProcessStatus, ProcessStatus } from "@/lib/process-status";
import {
  createManualParsedReceipt,
  deleteManualReceiptEntry,
  type CreateManualReceiptState,
  type DeleteManualReceiptState,
} from "@/lib/actions/receipts";
import {
  DEFAULT_ITEM_UNIT,
  ITEM_UNITS,
  normalizeItemUnit,
  type ItemUnit,
} from "@/lib/item-units";

type ReceiptMagicUploadProps = {
  title?: string;
  subtitle?: string;
  redirectToDashboard?: boolean;
  className?: string;
  normalizedNameOptions?: string[];
  manualEntries?: ManualReceiptEntry[];
  manualSecondary?: boolean;
};

type ManualReceiptEntry = {
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
};

type ManualItemDraft = {
  id: string;
  rawName: string;
  normalizedName: string;
  normalizedSource: "existing" | "custom";
  category: string;
  quantity: string;
  unit: ItemUnit;
  unitPrice: string;
};

const NEW_NORMALIZED_OPTION = "__new_normalized__";
const PROCESS_STORAGE_KEY = "notia:tracked-processes";

const initialUploadState: UploadReceiptState = {
  status: "idle",
};

const initialManualState: CreateManualReceiptState = {
  status: "idle",
};

const initialDeleteState: DeleteManualReceiptState = {
  status: "idle",
};

type TrackedProcess = {
  processId: string;
  status: ProcessStatus;
  updatedAt?: string;
  errorMessage?: string | null;
};

function loadTrackedProcessesFromStorage(): TrackedProcess[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PROCESS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackedProcess[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.processId === "string" &&
          typeof item.status === "string"
      )
      .map((item) => ({
        ...item,
        status: normalizeProcessStatus(item.status),
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

function createManualItem(defaultNormalizedName?: string): ManualItemDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    rawName: "",
    normalizedName: defaultNormalizedName ?? "",
    normalizedSource: defaultNormalizedName ? "existing" : "custom",
    category: "",
    quantity: "1",
    unit: DEFAULT_ITEM_UNIT,
    unitPrice: "",
  };
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReceiptMagicUpload({
  redirectToDashboard = false,
  className,
  normalizedNameOptions = [],
  manualEntries = [],
  manualSecondary = false,
}: ReceiptMagicUploadProps) {
  const t = useTranslations("ReceiptUpload");
  const locale = useLocale();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const uploadSteps = useMemo(
    () => [
      t("scanStepExtract"),
      t("scanStepIdentify"),
      t("scanStepCategorize"),
      t("scanStepFinalize"),
    ],
    [t]
  );

  const [uploadState, uploadAction, isUploadPending] = useActionState(
    submitReceiptForProcessing,
    initialUploadState
  );

  const [manualState, manualFormAction, isManualPending] = useActionState(
    createManualParsedReceipt,
    initialManualState
  );

  const [deleteState, deleteAction, isDeletePending] = useActionState(
    deleteManualReceiptEntry,
    initialDeleteState
  );

  const [entryMode, setEntryMode] = useState<"scan" | "manual">("scan");
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState(() => formatLocalDate(new Date()));
  const [manualTotalAmount, setManualTotalAmount] = useState("");
  const [manualCurrency, setManualCurrency] = useState("BRL");
  const [manualItems, setManualItems] = useState<ManualItemDraft[]>([
    createManualItem(normalizedNameOptions[0]),
  ]);

  const [isDragging, setIsDragging] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [cancelingProcessId, setCancelingProcessId] = useState<string | null>(null);
  const [trackedProcesses, setTrackedProcesses] = useState<TrackedProcess[]>(
    () => loadTrackedProcessesFromStorage()
  );

  const localeTag = locale === "pt" ? "pt-BR" : "en-US";

  const feedbackMessage = useMemo(() => {
    if (isUploadPending) {
      return uploadSteps[stepIndex] ?? uploadSteps[uploadSteps.length - 1];
    }

    if (localMessage) {
      return localMessage;
    }

    if (uploadState.status === "success") {
      return uploadState.message ?? t("scanSuccessDefault");
    }

    if (uploadState.status === "error") {
      return uploadState.message ?? t("scanErrorDefault");
    }

    return null;
  }, [
    isUploadPending,
    localMessage,
    stepIndex,
    t,
    uploadState.message,
    uploadState.status,
    uploadSteps,
  ]);

  const sortedManualEntries = useMemo(
    () => [...manualEntries].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [manualEntries]
  );
  const sortedTrackedProcesses = useMemo(
    () =>
      [...trackedProcesses].sort((a, b) => {
        const aTime = a.updatedAt ? +new Date(a.updatedAt) : 0;
        const bTime = b.updatedAt ? +new Date(b.updatedAt) : 0;
        return bTime - aTime;
      }),
    [trackedProcesses]
  );

  const manualItemsJson = useMemo(() => {
    const payload = manualItems.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;

      return {
        rawName: item.rawName.trim(),
        normalizedName: item.normalizedName.trim(),
        category: item.category.trim(),
        quantity,
        unit: item.unit,
        unitPrice,
        totalPrice: quantity * unitPrice,
      };
    });

    return JSON.stringify(payload);
  }, [manualItems]);

  const computedItemsTotal = useMemo(() => {
    return manualItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  }, [manualItems]);

  const resetManualForm = useCallback(() => {
    setEditingReceiptId(null);
    setManualDate(formatLocalDate(new Date()));
    setManualTotalAmount("");
    setManualCurrency("BRL");
    setManualItems([createManualItem(normalizedNameOptions[0])]);
  }, [normalizedNameOptions]);

  useEffect(() => {
    if (!isUploadPending) return;

    let step = 0;

    const interval = setInterval(() => {
      setStepIndex(step);
      step += 1;
      if (step > uploadSteps.length - 1) {
        step = uploadSteps.length - 1;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isUploadPending, uploadSteps]);

  useEffect(() => {
    if (uploadState.status !== "success") return;

    const timeout = setTimeout(() => {
      if (redirectToDashboard) {
        router.push("/dashboard");
      }
      router.refresh();
    }, 1100);

    return () => clearTimeout(timeout);
  }, [uploadState.status, redirectToDashboard, router]);

  useEffect(() => {
    if (manualState.status !== "success") return;

    const timeout = setTimeout(() => {
      setEditingReceiptId(null);
      if (redirectToDashboard) {
        router.push("/dashboard");
      }
      router.refresh();
    }, 900);

    return () => clearTimeout(timeout);
  }, [manualState.status, redirectToDashboard, router]);

  useEffect(() => {
    if (deleteState.status !== "success") return;
    router.refresh();
  }, [deleteState.status, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      PROCESS_STORAGE_KEY,
      JSON.stringify(trackedProcesses.slice(0, 20))
    );
  }, [trackedProcesses]);

  const sendFile = useCallback(
    (file: File) => {
      setLocalMessage(null);
      if (!file.type.startsWith("image/")) {
        setLocalMessage(t("scanInvalidFormat"));
        return;
      }
      const formData = new FormData();
      formData.append("receiptImage", file);
      startTransition(() => {
        uploadAction(formData);
      });
    },
    [t, uploadAction]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) sendFile(file);
      event.target.value = "";
    },
    [sendFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) sendFile(file);
    },
    [sendFile]
  );

  const updateManualItem = useCallback(
    <K extends keyof Omit<ManualItemDraft, "id">>(
      id: string,
      field: K,
      value: Omit<ManualItemDraft, "id">[K]
    ) => {
      setManualItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const changeNormalizedMode = useCallback((id: string, selectedValue: string) => {
    setManualItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (selectedValue === NEW_NORMALIZED_OPTION) {
          return {
            ...item,
            normalizedSource: "custom",
            normalizedName: "",
          };
        }

        return {
          ...item,
          normalizedSource: "existing",
          normalizedName: selectedValue,
        };
      })
    );
  }, []);

  const appendManualItem = useCallback(() => {
    setManualItems((prev) => [...prev, createManualItem(normalizedNameOptions[0])]);
  }, [normalizedNameOptions]);

  const removeManualItem = useCallback((id: string) => {
    setManualItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const fillTotalFromItems = useCallback(() => {
    setManualTotalAmount(computedItemsTotal.toFixed(2));
  }, [computedItemsTotal]);

  const startEditingEntry = useCallback(
    (entry: ManualReceiptEntry) => {
      setEntryMode("manual");
      setEditingReceiptId(entry.id);
      setManualDate(entry.date.slice(0, 10));
      setManualTotalAmount(entry.totalAmount.toFixed(2));
      setManualCurrency(entry.currency);
      setManualItems(
        entry.items.map((item) => ({
          id: item.id,
          rawName: item.rawName,
          normalizedName: item.normalizedName,
          normalizedSource: normalizedNameOptions.includes(item.normalizedName)
            ? "existing"
            : "custom",
          category: item.category,
          quantity: String(item.quantity),
          unit: normalizeItemUnit(item.unit),
          unitPrice: String(item.unitPrice),
        }))
      );
    },
    [normalizedNameOptions]
  );

  const handleDeleteEntry = useCallback(
    (receiptId: string) => {
      if (!window.confirm(t("manualDeleteConfirm"))) return;

      if (editingReceiptId === receiptId) {
        resetManualForm();
      }

      setDeletingReceiptId(receiptId);
      const formData = new FormData();
      formData.append("manualReceiptId", receiptId);
      startTransition(() => {
        deleteAction(formData);
      });
    },
    [deleteAction, editingReceiptId, resetManualForm, t]
  );

  const formatEntryDate = useCallback(
    (isoDate: string) => new Date(isoDate).toLocaleDateString(localeTag),
    [localeTag]
  );

  const formatCurrency = useCallback(
    (value: number, currency: string) => {
      try {
        return new Intl.NumberFormat(localeTag, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
        }).format(value);
      } catch {
        return `${currency} ${value.toFixed(2)}`;
      }
    },
    [localeTag]
  );

  const isManualFormValid = useMemo(() => {
    if (!manualDate.trim()) return false;
    if (!(Number(manualTotalAmount) > 0)) return false;

    return manualItems.every((item) => {
      return (
        item.rawName.trim().length > 0 &&
        item.normalizedName.trim().length > 0 &&
        item.category.trim().length > 0 &&
        Number(item.quantity) > 0 &&
        !!item.unit &&
        Number(item.unitPrice) > 0
      );
    });
  }, [manualDate, manualItems, manualTotalAmount]);

  const renderUnitOptionLabel = useCallback(
    (unit: ItemUnit) => {
      switch (unit) {
        case "MILLILITER":
          return t("manualUnitOptionMILLILITER");
        case "LITER":
          return t("manualUnitOptionLITER");
        case "GRAM":
          return t("manualUnitOptionGRAM");
        case "KILOGRAM":
          return t("manualUnitOptionKILOGRAM");
        case "UNIT":
        default:
          return t("manualUnitOptionUNIT");
      }
    },
    [t]
  );

  const upsertTrackedProcess = useCallback((nextItem: TrackedProcess) => {
    setTrackedProcesses((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.processId === nextItem.processId
      );
      if (existingIndex === -1) {
        return [nextItem, ...prev].slice(0, 20);
      }

      const copy = [...prev];
      copy[existingIndex] = {
        ...copy[existingIndex],
        ...nextItem,
      };
      return copy;
    });
  }, []);

  useEffect(() => {
    if (uploadState.status !== "success" || !uploadState.processId) return;

    const timer = setTimeout(() => {
      upsertTrackedProcess({
        processId: uploadState.processId!,
        status: normalizeProcessStatus(
          uploadState.processingStatus ?? ProcessStatus.PROCESSING
        ),
        updatedAt: new Date().toISOString(),
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [
    uploadState.status,
    uploadState.processId,
    uploadState.processingStatus,
    upsertTrackedProcess,
  ]);

  const activeProcessIds = useMemo(
    () =>
      trackedProcesses
        .filter((item) => !isTerminalProcessStatus(item.status))
        .map((item) => item.processId),
    [trackedProcesses]
  );

  useEffect(() => {
    if (activeProcessIds.length === 0) return;

    let canceled = false;

    const poll = async () => {
      const batchResult = await syncReceiptProcessingStatuses(
        activeProcessIds
      ).catch(() => null);

      if (canceled) return;
      if (!batchResult?.ok) return;

      setTrackedProcesses((prev) =>
        prev.map((item) => {
          const result = batchResult.results.find(
            (candidate) =>
              candidate &&
              candidate.ok &&
              candidate.processId === item.processId
          );
          if (!result || !result.status) return item;

          return {
            ...item,
            status: result.status,
            updatedAt: result.updatedAt ?? item.updatedAt,
            errorMessage: result.errorMessage ?? null,
          };
        })
      );
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      canceled = true;
      clearInterval(interval);
    };
  }, [activeProcessIds]);

  const renderProcessStatusLabel = useCallback(
    (status: ProcessStatus) => {
      if (status === ProcessStatus.PROCESSING) return t("scanStatusProcessing");
      if (status === ProcessStatus.PROCESSED) return t("scanStatusCompleted");
      if (status === ProcessStatus.ERROR) return t("scanStatusError");
      return t("scanStatusUnknown");
    },
    [t]
  );

  const processStatusClassName = useCallback((status: ProcessStatus) => {
    if (status === ProcessStatus.PROCESSING) {
      return "border-[rgba(255,149,0,0.25)] bg-[rgba(255,149,0,0.12)] text-[#c77700]";
    }
    if (status === ProcessStatus.PROCESSED) {
      return "border-[rgba(52,199,89,0.25)] bg-notia-green-dim text-notia-green";
    }
    if (status === ProcessStatus.ERROR) {
      return "border-[rgba(255,59,48,0.25)] bg-notia-red-dim text-notia-red";
    }
    return "border-[rgba(0,0,0,0.12)] bg-notia-bg text-notia-text-muted";
  }, []);

  const clearFinishedProcesses = useCallback(() => {
    setTrackedProcesses((prev) =>
      prev.filter((item) => !isTerminalProcessStatus(item.status))
    );
  }, []);

  const handleCancelProcess = useCallback(
    async (processId: string) => {
      if (cancelingProcessId === processId) return;
      if (!window.confirm(t("scanCancelConfirm"))) return;

      setCancelingProcessId(processId);

      try {
        const result = await cancelReceiptProcessing(processId);

        if (!result.ok || !result.status) {
          setLocalMessage(result.message ?? t("scanCancelError"));
          return;
        }
        const canceledStatus = normalizeProcessStatus(result.status);

        setTrackedProcesses((prev) =>
          prev.map((item) => {
            if (item.processId !== processId) return item;
            return {
              ...item,
              status: canceledStatus,
              updatedAt: result.updatedAt ?? new Date().toISOString(),
              errorMessage: result.errorMessage ?? null,
            };
          })
        );

        setLocalMessage(t("scanCancelSuccess"));
      } catch {
        setLocalMessage(t("scanCancelError"));
      } finally {
        setCancelingProcessId((current) =>
          current === processId ? null : current
        );
      }
    },
    [cancelingProcessId, t]
  );

  return (
    <div
      className={`rounded-[24px] border border-[rgba(0,0,0,0.07)] bg-white p-[20px_22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className ?? ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-notia-text-muted">
          {t("sectionTitle")}
        </p>
        {manualSecondary ? (
          <button
            type="button"
            onClick={() =>
              setEntryMode((prev) => (prev === "scan" ? "manual" : "scan"))
            }
            className="rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-notia-bg px-2.5 py-1 text-[11px] font-semibold text-notia-text-muted transition hover:text-notia-text"
          >
            {entryMode === "scan" ? t("manualFallbackAction") : t("scanPrimaryAction")}
          </button>
        ) : (
          <div className="flex rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-notia-bg p-1">
            <button
              type="button"
              onClick={() => setEntryMode("scan")}
              className={`rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition ${
                entryMode === "scan"
                  ? "bg-white text-notia-text shadow-[0_1px_4px_rgba(0,0,0,0.09)]"
                  : "text-notia-text-muted"
              }`}
            >
              {t("modeScan")}
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={`rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition ${
                entryMode === "manual"
                  ? "bg-white text-notia-text shadow-[0_1px_4px_rgba(0,0,0,0.09)]"
                  : "text-notia-text-muted"
              }`}
            >
              {t("modeManual")}
            </button>
          </div>
        )}
      </div>

      {entryMode === "scan" && (
        <div className="flex flex-wrap items-center gap-5">
          <div className="min-w-[260px] flex-1">
            <div
              className={`flex cursor-pointer items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed p-[18px_20px] transition ${
                isDragging
                  ? "scale-[1.01] border-[rgba(0,122,255,0.6)] bg-[rgba(0,122,255,0.12)]"
                  : "border-[rgba(0,122,255,0.28)] bg-[rgba(0,122,255,0.055)] hover:border-[rgba(0,122,255,0.5)] hover:bg-[rgba(0,122,255,0.09)]"
              }`}
              onClick={() => galleryInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
            >
              <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[13px] border border-[rgba(0,122,255,0.18)] bg-[linear-gradient(135deg,rgba(0,122,255,0.14),rgba(52,199,89,0.1))] text-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                &#128196;
              </div>
              <div>
                <p className="text-[13px] font-bold text-notia-text">{t("scanDropTitle")}</p>
                <p className="text-[11px] text-notia-text-muted">{t("scanDropHint")}</p>
              </div>
            </div>
          </div>

          <div className="flex min-w-[200px] flex-col gap-2">
            <div className="flex gap-2">
       
        
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isUploadPending}
                className="flex flex-1 items-center justify-center gap-[5px] rounded-[10px] border border-notia-accent bg-notia-accent p-[11px_6px] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)] transition hover:shadow-[0_4px_14px_rgba(0,122,255,0.38)] active:scale-[0.97] disabled:opacity-60"
              >
                &#10022; {t("scanProcess")}
              </button>
            </div>

            {feedbackMessage && (
              <div
                className={`animate-fade-up flex items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg p-[10px_14px] ${
                  uploadState.status === "error"
                    ? "border-[rgba(255,59,48,0.2)] bg-notia-red-dim"
                    : ""
                }`}
              >
                {isUploadPending && (
                  <span className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-[rgba(0,122,255,0.2)] border-t-notia-accent" />
                )}
                <span
                  className={`flex-1 text-[12px] ${
                    uploadState.status === "error"
                      ? "text-notia-red"
                      : uploadState.status === "success"
                        ? "font-bold text-notia-green"
                        : "text-notia-text-secondary"
                  }`}
                >
                  {uploadState.status === "success" && "✓  "}
                  {feedbackMessage}
                </span>
              </div>
            )}

            {sortedTrackedProcesses.length > 0 && (
              <div className="rounded-[10px] border border-[rgba(0,0,0,0.07)] bg-notia-bg p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-notia-text">
                    {t("scanProcessingTitle")}
                  </p>
                  <button
                    type="button"
                    onClick={clearFinishedProcesses}
                    className="text-[10px] font-semibold text-notia-text-muted underline"
                  >
                    {t("scanClearFinished")}
                  </button>
                </div>
                <p className="mb-2 text-[10px] text-notia-text-muted">
                  {t("scanProcessingHint")}
                </p>
                <div className="space-y-1.5">
                  {sortedTrackedProcesses.slice(0, 5).map((processItem) => {
                    const canCancel = !isTerminalProcessStatus(processItem.status);
                    const isCancellingCurrent =
                      cancelingProcessId === processItem.processId;

                    return (
                      <div
                        key={processItem.processId}
                        className="flex items-center justify-between rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-white px-2.5 py-1.5"
                      >
                        <span className="text-[10px] text-notia-text-muted">
                          {t("scanProcessIdLabel")}:{" "}
                          <span className="font-mono text-[10px] text-notia-text">
                            {processItem.processId.slice(0, 8)}
                          </span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold ${processStatusClassName(
                              processItem.status
                            )}`}
                          >
                            {renderProcessStatusLabel(processItem.status)}
                          </span>
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => {
                                void handleCancelProcess(processItem.processId);
                              }}
                              disabled={isCancellingCurrent}
                              className="rounded-[6px] border border-[rgba(255,59,48,0.25)] bg-notia-red-dim px-2 py-0.5 text-[10px] font-semibold text-notia-red transition hover:bg-[rgba(255,59,48,0.2)] disabled:opacity-60"
                            >
                              {isCancellingCurrent
                                ? t("scanCancelling")
                                : t("scanCancelAction")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />

          {manualSecondary && (
            <p className="w-full text-[11px] text-notia-text-muted">
              {t("manualFallbackHint")}{" "}
              <button
                type="button"
                onClick={() => setEntryMode("manual")}
                className="font-semibold text-notia-accent underline-offset-2 hover:underline"
              >
                {t("modeManual")}
              </button>
            </p>
          )}
        </div>
      )}

      {entryMode === "manual" && (
        <div className="space-y-3">
          <form action={manualFormAction} className="space-y-3">
            {editingReceiptId && (
              <div className="flex items-center justify-between rounded-[10px] border border-[rgba(0,122,255,0.2)] bg-[rgba(0,122,255,0.06)] px-3 py-2 text-[12px]">
                <span className="font-semibold text-notia-accent">{t("manualEditing")}</span>
                <button
                  type="button"
                  onClick={resetManualForm}
                  className="font-semibold text-notia-text-secondary"
                >
                  {t("manualCancelEdit")}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              <label className="text-[12px] text-notia-text-secondary">
                {t("manualDate")}
                <input
                  name="manualDate"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="mt-1 w-full rounded-[10px] border border-[rgba(0,0,0,0.12)] bg-white px-3 py-2 text-[13px] text-notia-text outline-none focus:border-[rgba(0,122,255,0.45)]"
                  required
                />
              </label>

              <label className="text-[12px] text-notia-text-secondary">
                {t("manualTotal")}
                <input
                  name="manualTotalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualTotalAmount}
                  onChange={(e) => setManualTotalAmount(e.target.value)}
                  className="mt-1 w-full rounded-[10px] border border-[rgba(0,0,0,0.12)] bg-white px-3 py-2 text-[13px] text-notia-text outline-none focus:border-[rgba(0,122,255,0.45)]"
                  required
                />
              </label>

              <label className="text-[12px] text-notia-text-secondary">
                {t("manualCurrency")}
                <input
                  name="manualCurrency"
                  type="text"
                  maxLength={5}
                  value={manualCurrency}
                  onChange={(e) => setManualCurrency(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-[10px] border border-[rgba(0,0,0,0.12)] bg-white px-3 py-2 text-[13px] text-notia-text outline-none focus:border-[rgba(0,122,255,0.45)]"
                  required
                />
              </label>
            </div>

            <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-notia-bg p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[12px] font-semibold text-notia-text">{t("manualItemsTitle")}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fillTotalFromItems}
                    className="rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-white px-2 py-1 text-[11px] font-semibold text-notia-text-secondary transition hover:text-notia-text"
                  >
                    {t("manualUseItemsTotal")}
                  </button>
                  <button
                    type="button"
                    onClick={appendManualItem}
                    className="rounded-[8px] border border-[rgba(0,122,255,0.25)] bg-white px-2 py-1 text-[11px] font-semibold text-notia-accent transition hover:bg-[rgba(0,122,255,0.06)]"
                  >
                    {t("manualAddItem")}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {manualItems.map((item, index) => {
                  const itemTotal =
                    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

                  return (
                    <div
                      key={item.id}
                      className="rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white p-2"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-notia-text-secondary">
                          Item {index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeManualItem(item.id)}
                          disabled={manualItems.length === 1}
                          className="text-[11px] font-semibold text-notia-red disabled:opacity-40"
                        >
                          {t("manualRemoveItem")}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-9">
                        <input
                          type="text"
                          value={item.rawName}
                          onChange={(e) =>
                            updateManualItem(item.id, "rawName", e.target.value)
                          }
                          placeholder={t("manualRawName")}
                          className="rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 py-1.5 text-[12px] outline-none focus:border-[rgba(0,122,255,0.45)] md:col-span-2"
                          required
                        />

                        <div className="space-y-1 md:col-span-2">
                          <select
                            value={
                              item.normalizedSource === "custom"
                                ? NEW_NORMALIZED_OPTION
                                : item.normalizedName
                            }
                            onChange={(e) =>
                              changeNormalizedMode(item.id, e.target.value)
                            }
                            className="w-full rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 py-1.5 text-[12px] outline-none focus:border-[rgba(0,122,255,0.45)]"
                          >
                            <option value="" disabled>
                              {t("manualChooseNormalized")}
                            </option>
                            {normalizedNameOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                            <option value={NEW_NORMALIZED_OPTION}>
                              {t("manualCreateNormalized")}
                            </option>
                          </select>

                          {item.normalizedSource === "custom" && (
                            <input
                              type="text"
                              value={item.normalizedName}
                              onChange={(e) =>
                                updateManualItem(
                                  item.id,
                                  "normalizedName",
                                  e.target.value
                                )
                              }
                              placeholder={t("manualNewNormalized")}
                              className="w-full rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 py-1.5 text-[12px] outline-none focus:border-[rgba(0,122,255,0.45)]"
                              required
                            />
                          )}
                        </div>

           

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateManualItem(item.id, "quantity", e.target.value)
                          }
                          placeholder={t("manualQuantity")}
                          className="rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 py-1.5 text-[12px] outline-none focus:border-[rgba(0,122,255,0.45)]"
                          required
                        />

                        <select
                          value={item.unit}
                          onChange={(e) =>
                            updateManualItem(item.id, "unit", normalizeItemUnit(e.target.value))
                          }
                          aria-label={t("manualUnit")}
                          className="rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 py-1.5 text-[12px] outline-none focus:border-[rgba(0,122,255,0.45)]"
                        >
                          {ITEM_UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {renderUnitOptionLabel(unit)}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateManualItem(item.id, "unitPrice", e.target.value)
                          }
                          placeholder={t("manualUnitPrice")}
                          className="rounded-[8px] border border-[rgba(0,0,0,0.12)] px-2 py-1.5 text-[12px] outline-none focus:border-[rgba(0,122,255,0.45)]"
                          required
                        />

                        <div className="flex items-center rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-notia-bg px-2 py-1.5 text-[12px] font-semibold text-notia-text">
                          {t("manualItemTotal")}: {itemTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {editingReceiptId && (
              <input type="hidden" name="manualReceiptId" value={editingReceiptId} />
            )}
            <input type="hidden" name="manualItemsJson" value={manualItemsJson} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-notia-text-muted">
                {t("manualItemsSum")}: <span className="font-semibold">{computedItemsTotal.toFixed(2)}</span>
              </p>

              <button
                type="submit"
                disabled={isManualPending || !isManualFormValid}
                className="rounded-[10px] border border-notia-accent bg-notia-accent px-4 py-2 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)] transition hover:shadow-[0_4px_14px_rgba(0,122,255,0.38)] disabled:opacity-60"
              >
                {isManualPending
                  ? t("manualSaving")
                  : editingReceiptId
                    ? t("manualUpdate")
                    : t("manualSave")}
              </button>
            </div>

            {manualState.status !== "idle" && (
              <div
                className={`rounded-[10px] border px-3 py-2 text-[12px] ${
                  manualState.status === "success"
                    ? "border-[rgba(52,199,89,0.25)] bg-notia-green-dim text-notia-green"
                    : "border-[rgba(255,59,48,0.25)] bg-notia-red-dim text-notia-red"
                }`}
              >
                {manualState.message}
              </div>
            )}
          </form>

          <div className="rounded-[14px] border border-[rgba(0,0,0,0.08)] bg-notia-bg p-2.5">
            <p className="mb-2 text-[12px] font-semibold text-notia-text">
              {t("manualSavedEntriesTitle")}
            </p>

            {sortedManualEntries.length === 0 && (
              <p className="rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[12px] text-notia-text-muted">
                {t("manualSavedEntriesEmpty")}
              </p>
            )}

            <div className="space-y-2">
              {sortedManualEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2"
                >
                  <div className="min-w-[180px]">
                    <p className="text-[12px] font-semibold text-notia-text">
                      {formatEntryDate(entry.date)} · {formatCurrency(entry.totalAmount, entry.currency)}
                    </p>
                    <p className="text-[11px] text-notia-text-muted">
                      {t("manualEntryItems", { count: entry.items.length })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditingEntry(entry)}
                      className="rounded-[8px] border border-[rgba(0,0,0,0.1)] bg-white px-2.5 py-1 text-[11px] font-semibold text-notia-text-secondary transition hover:text-notia-text"
                    >
                      {t("manualEditEntry")}
                    </button>
                    <button
                      type="button"
                      disabled={isDeletePending && deletingReceiptId === entry.id}
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="rounded-[8px] border border-[rgba(255,59,48,0.22)] bg-white px-2.5 py-1 text-[11px] font-semibold text-notia-red transition hover:bg-notia-red-dim disabled:opacity-60"
                    >
                      {isDeletePending && deletingReceiptId === entry.id
                        ? t("manualDeleting")
                        : t("manualDeleteEntry")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {deleteState.status === "error" && (
              <p className="mt-2 text-[12px] text-notia-red">
                {deleteState.message ?? t("manualDeleteErrorDefault")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isTerminalProcessStatus(status: string) {
  const normalized = normalizeProcessStatus(status);
  return normalized === ProcessStatus.PROCESSED || normalized === ProcessStatus.ERROR;
}
