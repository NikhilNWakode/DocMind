"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { api, Document, Workspace, IngestionProgress } from "@/lib/api";
import { formatFileSize, formatDate, getFileTypeIcon, getStatusColor } from "@/lib/utils";
import { ProcessingPipeline } from "@/components/documents/processing-pipeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Search,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudUpload,
  Sparkles,
  BarChart3,
  File,
  Eye,
} from "lucide-react";

interface DocumentWithProgress extends Document {
  progress?: IngestionProgress | null;
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const loadData = async () => {
    try {
      const [ws, docs] = await Promise.all([
        api.getWorkspace(workspaceId),
        api.listDocuments(workspaceId),
      ]);
      setWorkspace(ws);
      setDocuments(docs.documents);
    } catch (err) {
      console.error("Failed to load workspace:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  // Poll for processing documents status
  useEffect(() => {
    const processingDocs = documents.filter(
      (d) => d.status === "processing" || d.status === "pending"
    );
    if (processingDocs.length === 0) return;

    const interval = setInterval(async () => {
      for (const doc of processingDocs) {
        try {
          const status = await api.getDocumentStatus(doc.id);
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? { ...d, status: status.status, chunk_count: status.chunk_count, progress: status.progress }
                : d
            )
          );
        } catch {
          // ignore polling errors
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [documents]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        setUploading(true);
        setUploadProgress(`Uploading ${file.name}...`);
        try {
          const doc = await api.uploadDocument(workspaceId, file);
          setDocuments((prev) => [{ ...doc, progress: null }, ...prev]);
        } catch (err) {
          console.error("Upload failed:", err);
        }
      }
      setUploading(false);
      setUploadProgress("");
    },
    [workspaceId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    maxSize: 50 * 1024 * 1024,
  });

  const handleDelete = async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleSummarize = async (docId: string) => {
    try {
      await api.triggerSummarize(docId);
    } catch (err) {
      console.error("Summarize failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="skeleton h-8 w-48 mb-4 rounded" />
        <div className="skeleton h-4 w-72 mb-8 rounded" />
        <div className="skeleton h-44 rounded-2xl mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold">{workspace?.name}</h1>
          {workspace?.description && (
            <p className="text-text-secondary mt-1">{workspace.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="default">
              <FileText className="w-3 h-3" />
              {documents.length} documents
            </Badge>
            <Badge variant="success">
              {documents.filter((d) => d.status === "indexed").length} indexed
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={() => router.push(`/workspaces/${workspaceId}/search`)}
          >
            <Search className="w-4 h-4" />
            Search
          </Button>
          <Button onClick={() => router.push(`/workspaces/${workspaceId}/chat`)}>
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>
        </div>
      </motion.div>

      {/* Upload zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-8 md:p-10 text-center cursor-pointer transition-all duration-300 mb-8 overflow-hidden ${
          isDragActive
            ? "border-accent bg-accent/5 scale-[1.01]"
            : "border-border hover:border-accent/40 hover:bg-surface/50"
        }`}
      >
        <input {...getInputProps()} />

        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          {uploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-accent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium">{uploadProgress}</p>
                <p className="text-xs text-text-muted mt-1">Processing your document...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
                className="w-14 h-14 bg-surface border border-border rounded-2xl flex items-center justify-center"
              >
                <CloudUpload className="w-7 h-7 text-text-muted" />
              </motion.div>
              <div>
                <p className="text-sm font-medium">
                  {isDragActive ? "Drop files here" : "Drag & drop documents"}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  PDF, DOCX, TXT, PNG, JPG up to 50MB
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Documents list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Documents
          </h2>
        </div>

        {documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-surface/30 rounded-2xl border border-border/50"
          >
            <FileText className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary text-sm">
              No documents yet. Upload your first document above.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-border-light transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-surface-hover rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{getFileTypeIcon(doc.file_type)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                        <span>{formatFileSize(doc.file_size)}</span>
                        {doc.page_count && <span>{doc.page_count} pages</span>}
                        {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                        <span>{formatDate(doc.created_at)}</span>
                      </div>

                      {/* Processing pipeline for active documents */}
                      {(doc.status === "processing" || doc.status === "pending") && doc.progress && (
                        <div className="mt-3 max-w-md">
                          <ProcessingPipeline
                            currentStage={doc.progress.stage}
                            progress={doc.progress.progress}
                            message={doc.progress.message}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3">
                    {/* Status badge */}
                    <Badge
                      variant={
                        doc.status === "indexed"
                          ? "success"
                          : doc.status === "failed"
                          ? "error"
                          : doc.status === "processing"
                          ? "warning"
                          : "default"
                      }
                      size="sm"
                    >
                      {doc.status === "indexed" && <CheckCircle2 className="w-3 h-3" />}
                      {doc.status === "processing" && <Loader2 className="w-3 h-3 animate-spin" />}
                      {doc.status === "failed" && <AlertCircle className="w-3 h-3" />}
                      {doc.status}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.status === "indexed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSummarize(doc.id);
                          }}
                          className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-accent/10 transition-all"
                          title="Generate AI summary"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        className="p-1.5 text-text-muted hover:text-error rounded-md hover:bg-error/10 transition-all"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
