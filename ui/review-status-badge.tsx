import type { ProgressState, ResultReviewState } from "@/backend/report/report.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatProgressState, formatResultReviewState } from "@/ui/report-view";

export function ReviewStatusBadge({
  className,
  status,
  mode = "review",
  completed = 0,
  total = 0
}: {
  status: ProgressState | ResultReviewState;
  mode?: "progress" | "review";
  completed?: number;
  total?: number;
  className?: string;
}) {
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  return (
    <Badge
      className={cn(
        "w-fit font-semibold",
        isCompleted
          ? "border-[rgba(48,88,65,0.18)] bg-[var(--reviewed-bg)] text-[var(--reviewed-text)]"
          : isInProgress
            ? "border-[rgba(140,106,44,0.22)] bg-[rgba(242,223,180,0.48)] text-[#76531f]"
          : "border-[rgba(194,154,78,0.24)] bg-[var(--pending-bg)] text-[var(--pending-text)]",
        className
      )}
      variant="secondary"
    >
      {mode === "progress" ? formatProgressState(status, completed, total) : formatResultReviewState(status)}
    </Badge>
  );
}
