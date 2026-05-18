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
  BarChart3,
  ArrowRight,
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
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    "What are the main conclusions?",
    "Technical requirements",
    "Risk factors and mitigation",
    "Financial projections",
  ];

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setSearched(true);
    const startTime = Date.now();

    try {
      const data = await api.search(q, workspaceId, 10, false);
      setResults(data.results);
      setRetrievalMethod(data.retrieval_method);
      setSearchTime(Date.now() - startTime);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[26px] font-bold tracking-tight flex items-center gap-2.5">
            <Search className="w-6 h-6 text-accent/70" />
            Search
          </h1>
          {retrievalMethod && (
            <Badge variant="accent">
              {retrievalMethod === "hybrid" ? "Hybrid" : "Semantic"}
            </Badge>
          )}
        </div>
        <p className="text-text-muted text-[15px]">
          Search across all documents using natural language
        </p>
      </motion.div>

      {/* Search bar */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="relative mb-5"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your documents..."
            className="w-full pl-12 pr-24 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 transition-all duration-300 text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button type="submit" size="sm" loading={loading}>
              Search
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.form>

      {/* Search time */}
      {searchTime !== null && searched && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5 text-xs text-text-muted mb-6"
        >
          <Clock className="w-3.5 h-3.5" />
          {searchTime}ms
          <span className="mx-1">&middot;</span>
          {results.length} results
        </motion.div>
      )}

      {/* Suggestions */}
      {!searched && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3">
            Try searching for
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 bg-white/[0.02] border border-white/[0.04] rounded-full text-sm text-text-muted hover:text-text-primary hover:border-accent/20 hover:bg-accent/[0.03] transition-all duration-300"
              >
                {suggestion}
              </button>
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
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <Search className="w-10 h-10 text-text-muted/30 mx-auto mb-4" />
          <p className="text-text-secondary font-medium">No results found</p>
          <p className="text-text-muted text-sm mt-1">
            Try a different query or upload more documents
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {results.map((result, i) => (
              <motion.div
                key={result.chunk_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white/[0.01] border border-white/[0.04] rounded-xl p-5 hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-accent/[0.06] rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-accent/60" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-accent/80">
                        {result.document_title}
                      </span>
                      {result.page_number && (
                        <span className="text-[11px] text-text-muted ml-2">
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
                      {(result.relevance_score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>

                {/* Content */}
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
