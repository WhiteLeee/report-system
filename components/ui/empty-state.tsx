import * as React from "react";

import { cn } from "@/lib/utils";

function EmptyState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-[18px] py-[18px] text-center leading-[1.7] text-zinc-500",
        className
      )}
      {...props}
    />
  );
}

export { EmptyState };
