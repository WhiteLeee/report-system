import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tabsListVariants = cva("inline-flex items-center gap-1 rounded-lg bg-[var(--bg-accent)] p-1 text-[var(--muted)]", {
  variants: {
    orientation: {
      horizontal: "flex-row flex-wrap",
      vertical: "flex-col items-stretch"
    }
  },
  defaultVariants: {
    orientation: "horizontal"
  }
});

const tabsTriggerVariants = cva(
  "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-strong)]",
  {
    variants: {
      state: {
        active: "bg-white text-[var(--brand-strong)] shadow-sm",
        inactive: "text-[var(--muted)] hover:text-[var(--brand-strong)]"
      },
      orientation: {
        horizontal: "",
        vertical: "justify-start text-left"
      }
    },
    defaultVariants: {
      state: "inactive",
      orientation: "horizontal"
    }
  }
);

export function Tabs({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}

export function TabsList({
  className,
  orientation,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof tabsListVariants>) {
  return <div className={cn(tabsListVariants({ orientation }), className)} {...props} />;
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  asChild?: boolean;
  isActive?: boolean;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ asChild = false, className, isActive = false, orientation, state, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          tabsTriggerVariants({
            orientation,
            state: state || (isActive ? "active" : "inactive")
          }),
          className
        )}
        data-state={isActive ? "active" : "inactive"}
        ref={ref}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export function TabsContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}

export { tabsListVariants, tabsTriggerVariants };
