import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-950",
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
