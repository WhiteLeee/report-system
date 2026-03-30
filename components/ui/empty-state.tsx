import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-dashed border-[rgba(56,49,37,0.18)] bg-[rgba(255,255,255,0.6)] px-[18px] py-[18px] text-center leading-[1.7] text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export { EmptyState };
