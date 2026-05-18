"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileText,
  MessageSquare,
  Search,
  Zap,
  Clock,
  Brain,
  Database,
  TrendingUp,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api";

interface WorkspaceStats {
  totalDocuments: number;
  totalChunks: number;
  totalPages: number;
  indexedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-surface border border-border rounded-xl p-5 hover:border-border-light transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <TrendingUp className="w-4 h-4 text-success" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
    </motion.div>
  );
}

function MetricBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-24 truncate">{label}</span>
      <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-text-muted w-8 text-right">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const docs = await api.listDocuments(workspaceId);
        const documents = docs.documents;

        const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
        const totalPages = documents.reduce((sum, d) => sum + (d.page_count || 0), 0);

        setStats({
          totalDocuments: documents.length,
          totalChunks,
          totalPages,
          indexedDocuments: documents.filter((d) => d.status === "indexed").length,
          processingDocuments: documents.filter((d) => d.status === "processing").length,
          failedDocuments: documents.filter((d) => d.status === "failed").length,
        });
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="skeleton h-8 w-48 mb-8 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-64 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-accent" />
            Analytics
          </h1>
          <p className="text-text-secondary mt-1">
            Workspace performance and usage metrics
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-full">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span className="text-xs font-medium text-success">Live</span>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FileText className="w-5 h-5 text-accent" />}
          label="Documents"
          value={stats.totalDocuments}
          subtext={`${stats.indexedDocuments} indexed`}
          color="bg-accent/10"
          delay={0}
        />
        <StatCard
          icon={<Database className="w-5 h-5 text-purple-400" />}
          label="Total Chunks"
          value={stats.totalChunks.toLocaleString()}
          subtext="Vector embeddings"
          color="bg-purple-400/10"
          delay={0.1}
        />
        <StatCard
          icon={<Brain className="w-5 h-5 text-blue-400" />}
          label="Pages Processed"
          value={stats.totalPages.toLocaleString()}
          subtext="Across all documents"
          color="bg-blue-400/10"
          delay={0.2}
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-warning" />}
          label="Avg Chunks/Doc"
          value={stats.totalDocuments > 0 ? Math.round(stats.totalChunks / stats.totalDocuments) : 0}
          subtext="Per document"
          color="bg-warning/10"
          delay={0.3}
        />
      </div>

      {/* Detailed metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Status Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-surface border border-border rounded-xl p-6"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-text-muted" />
            Document Status
          </h3>
          <div className="space-y-3">
            <MetricBar
              label="Indexed"
              value={stats.indexedDocuments}
              max={stats.totalDocuments}
              color="bg-success"
            />
            <MetricBar
              label="Processing"
              value={stats.processingDocuments}
              max={stats.totalDocuments}
              color="bg-warning"
            />
            <MetricBar
              label="Failed"
              value={stats.failedDocuments}
              max={stats.totalDocuments}
              color="bg-error"
            />
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Success Rate</span>
              <span className="font-semibold text-success">
                {stats.totalDocuments > 0
                  ? `${Math.round((stats.indexedDocuments / stats.totalDocuments) * 100)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* System Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-surface border border-border rounded-xl p-6"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-muted" />
            System Capabilities
          </h3>
          <div className="space-y-3">
            {[
              { label: "Hybrid Retrieval", desc: "Dense + BM25 + RRF", active: true },
              { label: "Cross-Encoder Reranking", desc: "ms-marco-MiniLM", active: true },
              { label: "Semantic Caching", desc: "Cosine similarity match", active: true },
              { label: "OCR Processing", desc: "Tesseract + Pillow", active: true },
              { label: "Streaming Responses", desc: "SSE token streaming", active: true },
              { label: "Conversation Memory", desc: "Context summarization", active: true },
            ].map((cap, i) => (
              <div key={cap.label} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium">{cap.label}</p>
                  <p className="text-xs text-text-muted">{cap.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  Active
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Architecture Overview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6 bg-surface border border-border rounded-xl p-6"
      >
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4 text-text-muted" />
          RAG Pipeline Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Embedding Model", value: "MiniLM-L6-v2", icon: <Brain className="w-4 h-4" /> },
            { label: "Vector Dimensions", value: "384", icon: <Database className="w-4 h-4" /> },
            { label: "Chunk Size", value: "512 tokens", icon: <Layers className="w-4 h-4" /> },
            { label: "LLM", value: "Llama 3.3 70B", icon: <Sparkles className="w-4 h-4" /> },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-background rounded-lg border border-border/50">
              <div className="flex items-center gap-2 text-text-muted mb-1.5">
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </div>
              <p className="text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
