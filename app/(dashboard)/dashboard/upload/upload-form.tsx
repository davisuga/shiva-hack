"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelReceiptProcessing,
  syncReceiptProcessingStatus,
  submitReceiptForProcessing,
  type UploadReceiptState,
} from "@/lib/actions/process";

const initialUploadReceiptState: UploadReceiptState = {
  status: "idle",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Sending to Notia AI..." : "Scan Receipt"}
    </Button>
  );
}

export function UploadReceiptForm() {
  const [state, formAction] = useActionState(
    submitReceiptForProcessing,
    initialUploadReceiptState
  );
  const [tracking, setTracking] = useState<{
    status?: string;
    errorMessage?: string | null;
    updatedAt?: string;
    source?: "worker" | "database";
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const currentStatus = useMemo(() => {
    return tracking?.status || state.processingStatus || "queued";
  }, [tracking?.status, state.processingStatus]);

  useEffect(() => {
    if (state.status !== "success" || !state.processId) return;

    let active = true;
    let inFlight = false;
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    const poll = async () => {
      if (inFlight || !active) return;
      inFlight = true;

      try {
        const result = await syncReceiptProcessingStatus(state.processId!);
        if (!active || !result.ok) return;

        setTracking({
          status: result.status,
          errorMessage: result.errorMessage,
          updatedAt: result.updatedAt,
          source: result.source,
        });

        if (isTerminalStatus(result.status)) {
          setIsPolling(false);
          active = false;
          if (timer) {
            window.clearInterval(timer);
          }
        }
      } finally {
        inFlight = false;
      }
    };

    setTracking(null);
    setIsPolling(true);
    void poll();

    return () => {
      active = false;
      setIsPolling(false);
      window.clearInterval(timer);
    };
  }, [state.status, state.processId]);

  const handleCancel = async () => {
    if (!state.processId || isCancelling) return;
    if (!window.confirm("Cancel this processing job?")) return;

    setIsCancelling(true);
    try {
      const result = await cancelReceiptProcessing(state.processId);
      if (!result.ok) return;

      setTracking({
        status: result.status,
        errorMessage: result.errorMessage,
        updatedAt: result.updatedAt,
        source: "database",
      });
      setIsPolling(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="receiptImage" className="text-sm font-medium">
          Receipt image
        </label>
        <Input
          id="receiptImage"
          name="receiptImage"
          type="file"
          accept="image/*"
          required
        />
      </div>

      <SubmitButton />

      {state.status === "error" && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      {state.status === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p>{state.message}</p>
          {state.processId && (
            <p className="mt-1 font-mono text-xs">process_id: {state.processId}</p>
          )}
          <p className="mt-1">
            status: <span className="font-semibold">{currentStatus}</span>
          </p>
          {tracking?.errorMessage && (
            <p className="mt-1 text-red-700">error: {tracking.errorMessage}</p>
          )}
          {tracking?.updatedAt && (
            <p className="mt-1 text-xs text-green-700">
              last update: {new Date(tracking.updatedAt).toLocaleString()}
            </p>
          )}
          <p className="mt-1 text-xs text-green-700">
            {isPolling ? "polling database status..." : "status polling paused"}
            {tracking?.source ? ` (${tracking.source})` : ""}
          </p>
          {state.processId && !isTerminalStatus(currentStatus) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                void handleCancel();
              }}
              disabled={isCancelling}
            >
              {isCancelling ? "Canceling..." : "Cancel"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

function isTerminalStatus(status?: string) {
  if (!status) return false;

  const normalized = status.toLowerCase();
  return (
    normalized === "done" ||
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  );
}
