"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/api";

interface CitationPanelProps {
  citations: Citation[];
  onCitationClick?: (citation: Citation) => void;
}

function CitationPanel({ citations, onCitationClick }: CitationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  if (citations.length === 0) return null;

  return (
    <div className="border-t border-white/[0.04]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors duration-300"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-accent/[0.08] rounded-md flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-accent/70" />
          </div>
          <span className="text-sm font-medium text-text-secondary">
            {citations.length} source{citations.length !== 1 ? "s" : ""} cited
          </span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2">
              {citations.map((citation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => {
                    setHighlightedIndex(index);
                    onCitationClick?.(citation);
                  }}
                  className={cn(
                    "relative p-3.5 rounded-xl border cursor-pointer transition-all duration-300",
                    highlightedIndex === index
                      ? "border-accent/20 bg-accent/[0.04]"
                      : "border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02]"
                  )}
                >
                  <div className="absolute -left-1 -top-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{index + 1}</span>
                  </div>

                  <div className="flex items-center justify-between mb-2 ml-3">
                    <span className="text-xs font-semibold text-accent/80 truncate max-w-[60%]">
                      {citation.document_title}
                    </span>
                    <div className="flex items-center gap-2">
                      {citation.page_number && (
                        <Badge size="sm" variant="default">
                          <Hash className="w-2.5 h-2.5" />
                          Page {citation.page_number}
                        </Badge>
                      )}
                      {citation.relevance_score && (
                        <Badge size="sm" variant="success">
                          {(citation.relevance_score * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed line-clamp-3 ml-3">
                    {citation.chunk_content}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { CitationPanel };
