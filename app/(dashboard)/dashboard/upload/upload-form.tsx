"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
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
        </div>
      )}
    </form>
  );
}
