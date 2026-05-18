"use client";

import { motion } from "framer-motion";
import {
  Upload,
  FileSearch,
  Layers,
  Brain,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineStage {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const STAGES: PipelineStage[] = [
  { id: "uploading", label: "Uploading", icon: <Upload className="w-4 h-4" /> },
  { id: "extracting", label: "Extracting", icon: <FileSearch className="w-4 h-4" /> },
  { id: "chunking", label: "Chunking", icon: <Layers className="w-4 h-4" /> },
  { id: "embedding", label: "Embedding", icon: <Brain className="w-4 h-4" /> },
  { id: "indexing", label: "Indexing", icon: <Database className="w-4 h-4" /> },
  { id: "complete", label: "Ready", icon: <CheckCircle2 className="w-4 h-4" /> },
];

interface ProcessingPipelineProps {
  currentStage: string;
  progress: number;
  message?: string;
  error?: boolean;
}

function ProcessingPipeline({ currentStage, progress, message, error }: ProcessingPipelineProps) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="w-full">
      {/* Stage indicators */}
      <div className="flex items-center justify-between mb-3">
        {STAGES.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={stage.id} className="flex flex-col items-center gap-1.5 flex-1">
              {/* Connector line */}
              {index > 0 && (
                <div className="absolute" style={{ display: "none" }} />
              )}

              {/* Stage icon */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-success/10 text-success",
                  isCurrent && !error && "bg-accent/10 text-accent ring-2 ring-accent/30",
                  isCurrent && error && "bg-error/10 text-error ring-2 ring-error/30",
                  isPending && "bg-surface text-text-muted border border-border"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent && error ? (
                  <AlertCircle className="w-4 h-4" />
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-4 h-4" />
                  </motion.div>
                ) : (
                  stage.icon
                )}
              </motion.div>

              {/* Stage label */}
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isCompleted && "text-success",
                  isCurrent && !error && "text-accent",
                  isCurrent && error && "text-error",
                  isPending && "text-text-muted"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-border/50 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            error ? "bg-error" : "bg-gradient-to-r from-accent to-blue-400"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* Shimmer effect on active progress */}
        {!error && progress < 100 && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Message */}
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "text-xs mt-2 text-center",
            error ? "text-error" : "text-text-muted"
          )}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}

export { ProcessingPipeline };
