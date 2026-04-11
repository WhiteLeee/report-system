import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm text-[var(--text)] shadow-sm transition-[color,box-shadow,border-color] outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-[var(--brand-strong)] focus-visible:ring-1 focus-visible:ring-[var(--brand-strong)]",
        className
      )}
      type={type}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
