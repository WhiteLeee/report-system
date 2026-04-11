import type { ProgressState, ResultReviewState } from "@/backend/report/report.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatProgressState, formatResultReviewState } from "@/ui/report/report-view";

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
        "w-fit font-medium",
        isCompleted
          ? "border-transparent bg-[var(--bg-accent)] text-[var(--text)]"
          : isInProgress
            ? "border-transparent bg-amber-100 text-amber-900"
            : "border-transparent bg-[var(--bg-accent)] text-[var(--muted)]",
        className
      )}
      variant="secondary"
    >
      {mode === "progress" ? formatProgressState(status, completed, total) : formatResultReviewState(status)}
    </Badge>
  );
}
