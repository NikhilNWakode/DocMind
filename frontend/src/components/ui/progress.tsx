"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "success" | "warning" | "accent";
  size?: "sm" | "md" | "lg";
}

const variantColors = {
  default: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  accent: "bg-gradient-to-r from-accent to-blue-400",
};

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

function Progress({ value, max = 100, className, showLabel, variant = "default", size = "md" }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-text-muted">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn("w-full bg-border/50 rounded-full overflow-hidden", sizeClasses[size])}>
        <motion.div
          className={cn("h-full rounded-full", variantColors[variant])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export { Progress };
