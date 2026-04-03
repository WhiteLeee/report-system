import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex appearance-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow,background-color,border-color] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950",
  {
    variants: {
      variant: {
        default: "bg-zinc-900 text-zinc-50 shadow-sm hover:bg-zinc-800",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
        outline: "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-100",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
        link: "h-auto px-0 py-0 text-zinc-950 underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
