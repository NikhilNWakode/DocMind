"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { api, Document, Conversation } from "@/lib/api";
import { useChatStore } from "@/stores/chat";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { CitationPanel } from "@/components/chat/citation-panel";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { formatFileSize, formatDate, getFileTypeIcon } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Sparkles,
  User,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudUpload,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  RotateCcw,
} from "lucide-react";

const DEFAULT_WORKSPACE_NAME = "My Documents";

export default function DashboardPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [showDocs, setShowDocs] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    citations,
    conversationId,
    metadata,
    error,
    sendMessage,
    loadConversation,
    clearChat,
  } = useChatStore();

  // Auto-create or fetch default workspace
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        const data = await api.listWorkspaces();
        if (data.workspaces.length > 0) {
          // Use existing workspace
          const ws = data.workspaces[0];
          setWorkspaceId(ws.id);
        } else {
          // Create default workspace
          const ws = await api.createWorkspace(DEFAULT_WORKSPACE_NAME, "Default workspace");
          setWorkspaceId(ws.id);
        }
      } catch (err) {
        console.error("Failed to init workspace:", err);
      } finally {
        setLoading(false);
      }
    };
    initWorkspace();
  }, []);

  // Load documents and conversations when workspace is ready
  useEffect(() => {
    if (!workspaceId) return;

    const loadData = async () => {
      try {
        const [docs, convs] = await Promise.all([
          api.listDocuments(workspaceId),
          api.listConversations(workspaceId),
        ]);
        setDocuments(docs.documents);
        setConversations(convs.conversations);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };
    loadData();
  }, [workspaceId, conversationId]);

  // Poll for processing documents
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
                ? { ...d, status: status.status, chunk_count: status.chunk_count }
                : d
            )
          );
        } catch {
          // ignore
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!workspaceId) return;
      for (const file of acceptedFiles) {
        setUploading(true);
        setUploadProgress(`Uploading ${file.name}...`);
        try {
          const doc = await api.uploadDocument(workspaceId, file);
          setDocuments((prev) => [doc, ...prev]);
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
    },
    maxSize: 50 * 1024 * 1024,
  });

  const handleDeleteDoc = async (docId: string) => {
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !workspaceId) return;
    const query = input.trim();
    setInput("");
    await sendMessage(query, workspaceId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (conversationId === convId) clearChat();
    } catch (err) {
      console.error("Delete conversation failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-10 h-10 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Setting up...</p>
        </motion.div>
      </div>
    );
  }

  const indexedCount = documents.filter((d) => d.status === "indexed").length;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left panel — Documents */}
      <AnimatePresence mode="wait">
        {showDocs && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 320 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="border-r border-white/[0.04] bg-surface/30 flex flex-col overflow-hidden"
          >
            {/* Upload zone */}
            <div className="p-3 border-b border-white/[0.04]">
              <div
                {...getRootProps()}
                className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? "border-accent/40 bg-accent/[0.03]"
                    : "border-white/[0.06] hover:border-accent/20"
                }`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    <span className="text-xs text-text-muted">{uploadProgress}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <CloudUpload className="w-5 h-5 text-text-muted" />
                    <div className="text-left">
                      <p className="text-xs font-medium text-text-secondary">
                        {isDragActive ? "Drop here" : "Upload documents"}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">PDF, DOCX, TXT</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Document stats */}
            <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2">
              <Badge variant="default" size="sm">
                <FileText className="w-3 h-3" />
                {documents.length} docs
              </Badge>
              <Badge variant="success" size="sm">
                {indexedCount} indexed
              </Badge>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {documents.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <FileText className="w-7 h-7 text-text-muted/30 mx-auto mb-3" />
                  <p className="text-xs text-text-muted">Upload a document to get started</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0">{getFileTypeIcon(doc.file_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate text-text-secondary">
                          {doc.title}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                          <span>{formatFileSize(doc.file_size)}</span>
                          {doc.status === "indexed" && (
                            <CheckCircle2 className="w-3 h-3 text-success" />
                          )}
                          {doc.status === "processing" && (
                            <Loader2 className="w-3 h-3 text-warning animate-spin" />
                          )}
                          {doc.status === "failed" && (
                            <AlertCircle className="w-3 h-3 text-error" />
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-error rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Conversations */}
            <div className="border-t border-white/[0.04]">
              <div className="p-2">
                <button
                  onClick={clearChat}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text-primary bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.04] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New chat
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto px-2 pb-2 space-y-0.5">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all text-[12px] ${
                      conversationId === conv.id
                        ? "bg-accent/[0.08] text-accent"
                        : "text-text-muted hover:text-text-primary hover:bg-white/[0.03]"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className="w-3 h-3 flex-shrink-0 opacity-50" />
                      <span className="truncate">{conv.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-error rounded transition-all"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right panel — Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-11 border-b border-white/[0.04] flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-white/[0.04] transition-all"
            >
              {showDocs ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
            <span className="text-[13px] font-medium text-text-muted">
              {conversationId ? "Conversation" : "New chat"}
            </span>
          </div>
          {metadata && !isStreaming && (
            <div className="flex items-center gap-2">
              <Badge size="sm" variant="default">
                {metadata.model}
              </Badge>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-md"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-accent/10 to-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-7 border border-accent/[0.1]">
                  <Sparkles className="w-7 h-7 text-accent/70" />
                </div>
                <h2 className="text-xl font-semibold mb-3 tracking-tight">
                  Chat with your documents
                </h2>
                <p className="text-text-muted text-sm leading-relaxed mb-8">
                  Upload a PDF, then ask anything. AI will find relevant passages and answer with citations.
                </p>
                {indexedCount === 0 ? (
                  <p className="text-text-muted text-sm">
                    Upload a document from the left panel to get started
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "What are the key findings?",
                      "Summarize the main topics",
                      "What are the conclusions?",
                      "Explain the methodology",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-4 py-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-sm text-text-muted hover:text-text-primary hover:border-accent/20 hover:bg-accent/[0.03] transition-all duration-300 text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/[0.08] to-purple-500/[0.08] border border-accent/[0.1] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-accent/70" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] md:max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-accent/90 text-white rounded-2xl rounded-br-md px-4 py-3"
                        : ""
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : msg.content === "" && isStreaming && i === messages.length - 1 ? (
                      <TypingIndicator />
                    ) : (
                      <MarkdownRenderer
                        content={msg.content}
                        isStreaming={isStreaming && i === messages.length - 1}
                      />
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-text-muted" />
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-2"
            >
              <div className="max-w-3xl mx-auto bg-error/[0.06] border border-error/[0.1] text-error rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Citations */}
        <CitationPanel citations={citations} />

        {/* Input */}
        <div className="border-t border-white/[0.04] bg-background/80 backdrop-blur-xl p-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto flex items-end gap-3"
          >
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  indexedCount === 0
                    ? "Upload a document first..."
                    : "Ask about your documents..."
                }
                disabled={indexedCount === 0}
                rows={1}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 resize-none transition-all duration-300 disabled:opacity-40"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming || indexedCount === 0}
              className="p-3 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
