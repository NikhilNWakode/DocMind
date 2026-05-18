"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, SearchResult } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileText,
  Loader2,
  Zap,
  BarChart3,
  Sparkles,
  Filter,
  ArrowRight,
  Hash,
  Clock,
} from "lucide-react";

export default function SearchPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [retrievalMethod, setRetrievalMethod] = useState("");
  const [useReranking, setUseReranking] = useState(true);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    "What are the main conclusions?",
    "Technical requirements",
    "Risk factors and mitigation",
    "Financial projections",
  ];

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    const startTime = Date.now();

    try {
      const data = await api.search(query, workspaceId, 10, useReranking);
      setResults(data.results);
      setRetrievalMethod(data.retrieval_method);
      setSearchTime(Date.now() - startTime);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    // Auto-search
    setTimeout(() => {
      setQuery(suggestion);
      setLoading(true);
      setSearched(true);
      const startTime = Date.now();
      api.search(suggestion, workspaceId, 10, useReranking).then((data) => {
        setResults(data.results);
        setRetrievalMethod(data.retrieval_method);
        setSearchTime(Date.now() - startTime);
        setLoading(false);
      });
    }, 0);
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Search className="w-6 h-6 text-accent" />
            Semantic Search
          </h1>
          {retrievalMethod && (
            <Badge variant="accent">
              <Zap className="w-3 h-3" />
              {retrievalMethod === "hybrid" ? "Hybrid (Dense + BM25 + RRF)" : "Dense"}
            </Badge>
          )}
        </div>
        <p className="text-text-secondary text-sm">
          Search across all documents using natural language
        </p>
      </motion.div>

      {/* Search bar */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSearch}
        className="relative mb-4"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your documents..."
            className="w-full pl-12 pr-24 py-4 bg-surface border border-border rounded-2xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button type="submit" size="sm" loading={loading}>
              Search
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.form>

      {/* Options row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-between mb-6"
      >
        <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useReranking}
            onChange={(e) => setUseReranking(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-surface accent-accent"
          />
          <span>Cross-encoder reranking</span>
        </label>

        {searchTime !== null && searched && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="w-3.5 h-3.5" />
            {searchTime}ms
            <span className="mx-1">·</span>
            {results.length} results
          </div>
        )}
      </motion.div>

      {/* Query suggestions (shown when no search yet) */}
      {!searched && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Try searching for
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <motion.button
                key={suggestion}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 bg-surface border border-border rounded-full text-sm text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <Search className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary font-medium">No results found</p>
          <p className="text-text-muted text-sm mt-1">
            Try a different query or check your document filters
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {results.map((result, i) => (
              <motion.div
                key={result.chunk_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ borderColor: "rgba(59, 130, 246, 0.3)" }}
                className="bg-surface border border-border rounded-xl p-5 transition-all"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-accent">
                        {result.document_title}
                      </span>
                      {result.page_number && (
                        <span className="text-xs text-text-muted ml-2">
                          Page {result.page_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.rerank_score !== null && (
                      <Badge variant="success" size="sm">
                        <BarChart3 className="w-3 h-3" />
                        {result.rerank_score.toFixed(3)}
                      </Badge>
                    )}
                    <Badge variant="accent" size="sm">
                      {(result.relevance_score * 100).toFixed(0)}% match
                    </Badge>
                  </div>
                </div>

                {/* Content snippet */}
                <p className="text-sm text-text-secondary leading-relaxed">
                  {result.content}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
