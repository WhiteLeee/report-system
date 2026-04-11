import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 pr-9 text-sm text-[var(--text)] shadow-sm transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-[var(--brand-strong)] focus-visible:ring-1 focus-visible:ring-[var(--brand-strong)]",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      </div>
    );
  }
);

NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
