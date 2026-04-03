import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-zinc-200 bg-white px-3 py-1 pr-9 text-sm text-zinc-950 shadow-sm transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-950",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>
    );
  }
);

NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
