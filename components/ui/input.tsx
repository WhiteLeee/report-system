import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-950 shadow-sm transition-[color,box-shadow,border-color] outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-950",
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
