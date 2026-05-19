"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { api, Document, Conversation } from "@/lib/api";
import { useChatStore } from "@/stores/chat";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { CitationPanel } from "@/components/chat/citation-panel";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { formatDate, getFileTypeIcon } from "@/lib/utils";
import {
  Send,
  Sparkles,
  User,
  FileText,
  Trash2,
  Loader2,
  CloudUpload,
  Plus,
  MessageSquare,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const DEFAULT_WORKSPACE_NAME = "My Documents";

type ChatState = "empty" | "uploading" | "processing" | "ready";

export default function DashboardPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");

  // Current chat's document state
  const [chatState, setChatState] = useState<ChatState>("empty");
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [processingProgress, setProcessingProgress] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    citations,
    conversationId,
    documentId,
    metadata,
    error,
    sendMessage,
    loadConversation,
    clearChat,
    setDocumentId,
  } = useChatStore();

  // Auto-create or fetch default workspace
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        const data = await api.listWorkspaces();
        if (data.workspaces.length > 0) {
          setWorkspaceId(data.workspaces[0].id);
        } else {
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

  // Load conversations when workspace is ready
  const loadConversations = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const convs = await api.listConversations(workspaceId);
      setConversations(convs.conversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, conversationId]);

  // Poll document status while processing
  useEffect(() => {
    if (chatState !== "processing" || !currentDoc) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getDocumentStatus(currentDoc.id);
        if (status.status === "indexed") {
          setCurrentDoc((prev) => prev ? { ...prev, status: "indexed", chunk_count: status.chunk_count } : null);
          setChatState("ready");
          setProcessingProgress("");
        } else if (status.status === "failed") {
          setChatState("empty");
          setUploadError(status.error_message || "Document processing failed");
          setCurrentDoc(null);
          setProcessingProgress("");
        } else if (status.progress) {
          setProcessingProgress(status.progress.message || "Processing...");
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [chatState, currentDoc]);

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
      if (!workspaceId || acceptedFiles.length === 0) return;
      const file = acceptedFiles[0]; // One document per chat

      setChatState("uploading");
      setUploadError("");

      try {
        const doc = await api.uploadDocument(workspaceId, file);
        setCurrentDoc(doc);
        setDocumentId(doc.id);

        if (doc.status === "indexed") {
          setChatState("ready");
        } else {
          setChatState("processing");
          setProcessingProgress("Starting processing...");

          // Also connect to SSE progress
          api.streamIngestionProgress(
            doc.id,
            (progress) => {
              setProcessingProgress(progress.message || `${progress.stage}...`);
            },
            () => {
              // Complete — polling will catch the final status
            },
            (err) => {
              console.error("Progress stream error:", err);
            }
          );
        }
      } catch (err) {
        setChatState("empty");
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [workspaceId, setDocumentId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !workspaceId || chatState !== "ready") return;
    const query = input.trim();
    setInput("");
    await sendMessage(query, workspaceId, currentDoc?.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNewChat = () => {
    clearChat();
    setChatState("empty");
    setCurrentDoc(null);
    setUploadError("");
    setProcessingProgress("");
  };

  const handleLoadConversation = async (conv: Conversation) => {
    await loadConversation(conv.id);

    // If this conversation has a linked document, set state to ready
    if (conv.document_id) {
      try {
        const status = await api.getDocumentStatus(conv.document_id);
        setCurrentDoc({
          id: conv.document_id,
          workspace_id: conv.workspace_id,
          title: conv.title,
          file_type: "pdf",
          file_size: 0,
          page_count: null,
          status: status.status,
          chunk_count: status.chunk_count,
          error_message: null,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        });
        setDocumentId(conv.document_id);
        setChatState(status.status === "indexed" ? "ready" : "empty");
      } catch {
        // Document might have been deleted — still show messages
        setChatState("ready");
        setCurrentDoc(null);
      }
    } else {
      setChatState("ready");
      setCurrentDoc(null);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (conversationId === convId) handleNewChat();
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

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Sidebar — Past chats */}
      <div className="w-64 border-r border-white/[0.04] bg-surface/30 flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-text-secondary hover:text-text-primary bg-white/[0.03] hover:bg-accent/[0.06] rounded-xl border border-white/[0.06] hover:border-accent/20 transition-all duration-300"
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-6 h-6 text-text-muted/20 mx-auto mb-3" />
              <p className="text-[11px] text-text-muted/60">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                  conversationId === conv.id
                    ? "bg-accent/[0.08] border border-accent/[0.12]"
                    : "hover:bg-white/[0.03] border border-transparent"
                }`}
                onClick={() => handleLoadConversation(conv)}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-sm flex-shrink-0 opacity-50">
                    {getFileTypeIcon("pdf")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-medium truncate ${
                      conversationId === conv.id ? "text-accent" : "text-text-secondary"
                    }`}>
                      {conv.title}
                    </p>
                    <p className="text-[10px] text-text-muted/60 mt-0.5">
                      {formatDate(conv.updated_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-error rounded transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-12 border-b border-white/[0.04] flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            {currentDoc ? (
              <>
                <span className="text-sm">{getFileTypeIcon(currentDoc.file_type)}</span>
                <span className="text-[13px] font-medium text-text-secondary truncate max-w-xs">
                  {currentDoc.title}
                </span>
                {currentDoc.status === "indexed" && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                )}
                {currentDoc.status === "processing" && (
                  <Loader2 className="w-3.5 h-3.5 text-warning animate-spin flex-shrink-0" />
                )}
              </>
            ) : (
              <span className="text-[13px] font-medium text-text-muted">New chat</span>
            )}
          </div>
          {metadata && !isStreaming && (
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <span className="px-2 py-0.5 bg-white/[0.04] rounded-md">{metadata.model}</span>
              <span>{metadata.latency_ms}ms</span>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-lg w-full"
              >
                {/* Empty state — Upload prompt */}
                {chatState === "empty" && (
                  <>
                    <div className="w-16 h-16 bg-gradient-to-br from-accent/10 to-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-accent/[0.1]">
                      <Sparkles className="w-8 h-8 text-accent/70" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-3 tracking-tight">
                      Chat with a document
                    </h2>
                    <p className="text-text-muted text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                      Upload a PDF, DOCX, or TXT file. Ask questions and get AI-powered answers with citations.
                    </p>

                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-300 mx-auto max-w-sm ${
                        isDragActive
                          ? "border-accent/50 bg-accent/[0.05] scale-[1.02]"
                          : "border-white/[0.08] hover:border-accent/30 hover:bg-white/[0.02]"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <CloudUpload className={`w-10 h-10 mx-auto mb-4 transition-colors ${
                        isDragActive ? "text-accent" : "text-text-muted/40"
                      }`} />
                      <p className="text-sm font-medium text-text-secondary mb-1">
                        {isDragActive ? "Drop your file here" : "Drop a file or click to upload"}
                      </p>
                      <p className="text-xs text-text-muted/60">PDF, DOCX, TXT up to 50MB</p>
                    </div>

                    {uploadError && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-error text-sm mt-4 flex items-center justify-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {uploadError}
                      </motion.p>
                    )}
                  </>
                )}

                {/* Uploading state */}
                {chatState === "uploading" && (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-accent animate-spin" />
                    <p className="text-sm text-text-secondary">Uploading document...</p>
                  </div>
                )}

                {/* Processing state */}
                {chatState === "processing" && currentDoc && (
                  <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                      <div className="w-16 h-16 bg-accent/[0.06] rounded-2xl flex items-center justify-center border border-accent/[0.1]">
                        <FileText className="w-8 h-8 text-accent/60" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-background border-2 border-warning rounded-full flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-warning animate-spin" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-secondary mb-1">{currentDoc.title}</p>
                      <p className="text-xs text-text-muted">{processingProgress || "Processing..."}</p>
                    </div>
                    <div className="w-48 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-accent/60 rounded-full"
                        initial={{ width: "10%" }}
                        animate={{ width: "90%" }}
                        transition={{ duration: 30, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}

                {/* Ready state — show suggestions */}
                {chatState === "ready" && (
                  <>
                    <div className="w-14 h-14 bg-gradient-to-br from-accent/10 to-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-7 border border-accent/[0.1]">
                      <Sparkles className="w-7 h-7 text-accent/70" />
                    </div>
                    <h2 className="text-xl font-semibold mb-3 tracking-tight">
                      {currentDoc?.title || "Ask a question"}
                    </h2>
                    <p className="text-text-muted text-sm leading-relaxed mb-8">
                      Your document is ready. Ask anything about it.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
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
                  </>
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
                  chatState !== "ready"
                    ? "Upload a document to start chatting..."
                    : "Ask about your document..."
                }
                disabled={chatState !== "ready"}
                rows={1}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 resize-none transition-all duration-300 disabled:opacity-40"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming || chatState !== "ready"}
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
