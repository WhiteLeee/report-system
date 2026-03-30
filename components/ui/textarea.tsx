import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[112px] w-full rounded-[14px] border border-[rgba(56,49,37,0.16)] bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-[var(--text)] outline-none transition-[border-color,box-shadow,background] placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 focus:border-[rgba(141,98,58,0.48)] focus:bg-white focus:ring-4 focus:ring-[rgba(141,98,58,0.12)]",
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
