"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-white/[0.04] border border-white/[0.06] text-text-secondary",
        accent: "bg-accent/[0.08] text-accent border border-accent/[0.12]",
        success: "bg-success/[0.08] text-success border border-success/[0.12]",
        warning: "bg-warning/[0.08] text-warning border border-warning/[0.12]",
        error: "bg-error/[0.08] text-error border border-error/[0.12]",
      },
      size: {
        sm: "text-[10px] px-1.5 py-0.5 rounded-md",
        md: "text-xs px-2.5 py-1 rounded-full",
        lg: "text-sm px-3 py-1.5 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
