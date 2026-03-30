import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-[14px] border border-[rgba(56,49,37,0.16)] bg-[rgba(255,255,255,0.88)] px-4 text-sm text-[var(--text)] shadow-none outline-none transition-[border-color,box-shadow,background] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 focus:border-[rgba(141,98,58,0.48)] focus:bg-white focus:ring-4 focus:ring-[rgba(141,98,58,0.12)]",
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
