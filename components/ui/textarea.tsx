import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-[var(--brand-strong)] focus-visible:ring-1 focus-visible:ring-[var(--brand-strong)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
