import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-[18px] py-[18px] text-center leading-[1.7] text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export { EmptyState };
