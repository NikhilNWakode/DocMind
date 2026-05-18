"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-text-primary placeholder:text-text-muted/60",
            "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all duration-300",
            icon && "pl-11",
            error && "border-error/30 focus:ring-error/30",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-error">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
