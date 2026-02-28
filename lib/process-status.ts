export enum ProcessStatus {
  PROCESSING = "Processing",
  PROCESSED = "Processed",
  ERROR = "Error",
}

export function normalizeProcessStatus(status?: string | null): ProcessStatus {
  if (!status) return ProcessStatus.PROCESSING;

  const normalized = status.toLowerCase();
  if (
    normalized === "done" ||
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "processed"
  ) {
    return ProcessStatus.PROCESSED;
  }

  if (
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return ProcessStatus.ERROR;
  }

  return ProcessStatus.PROCESSING;
}

export function isTerminalProcessStatus(status?: string | null): boolean {
  const normalized = normalizeProcessStatus(status);
  return normalized === ProcessStatus.PROCESSED || normalized === ProcessStatus.ERROR;
}
