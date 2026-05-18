"use client";

import { Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function Dialog({ open, onClose, children, className }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "w-full max-w-md bg-surface border border-white/[0.06] rounded-2xl p-7 shadow-2xl",
              className
            )}
          >
            <button
              onClick={onClose}
              className="absolute right-5 top-5 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {children}
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  );
}

function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold mb-2 tracking-tight", className)}>{children}</h2>;
}

function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-text-muted mb-6", className)}>{children}</p>;
}

export { Dialog, DialogTitle, DialogDescription };
