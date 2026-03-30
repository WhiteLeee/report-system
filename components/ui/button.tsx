import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(141,98,58,0.12)]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,var(--brand),var(--brand-strong))] text-[#fffdf9] shadow-sm hover:brightness-[1.03]",
        secondary:
          "border border-[color:var(--line)] bg-[rgba(255,255,255,0.78)] text-[var(--text)] hover:bg-white",
        ghost: "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.74)]"
      },
      size: {
        default: "h-12 px-4 py-2",
        sm: "h-10 px-3 py-2",
        lg: "h-14 px-6 py-3",
        icon: "size-10"
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
