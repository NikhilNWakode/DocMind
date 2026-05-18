"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-accent hover:bg-accent-hover text-white shadow-[0_0_20px_-4px_rgba(139,124,246,0.25)] hover:shadow-[0_0_25px_-4px_rgba(139,124,246,0.35)]",
        secondary: "bg-white/[0.04] border border-white/[0.06] text-text-secondary hover:text-text-primary hover:border-white/[0.1] hover:bg-white/[0.06]",
        ghost: "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]",
        danger: "bg-error/[0.08] text-error hover:bg-error/[0.14] border border-error/[0.12]",
        accent: "bg-accent/[0.08] text-accent hover:bg-accent/[0.14]",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-lg",
        md: "h-9 px-4 text-sm rounded-lg",
        lg: "h-11 px-6 text-sm rounded-xl",
        icon: "h-9 w-9 rounded-lg",
        "icon-sm": "h-7 w-7 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
