"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chat";
import { api, Conversation } from "@/lib/api";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { CitationPanel } from "@/components/chat/citation-panel";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Sparkles,
  User,
  MessageSquare,
  Plus,
  Zap,
  Clock,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  RotateCcw,
} from "lucide-react";

export default function ChatPage() {
  const params = useParams();
  const workspaceId = params.id as string;

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

  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.listConversations(workspaceId).then((data) => {
      setConversations(data.conversations);
    });
  }, [workspaceId, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
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

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-screen flex">
      {/* Conversation sidebar */}
      <AnimatePresence mode="wait">
        {showSidebar && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 260 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="border-r border-white/[0.04] bg-surface/30 flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-white/[0.04] flex-shrink-0">
              <button
                onClick={clearChat}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                New chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {conversations.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <MessageSquare className="w-7 h-7 text-text-muted/40 mx-auto mb-3" />
                  <p className="text-xs text-text-muted">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                      conversationId === conv.id
                        ? "bg-accent/[0.08] text-accent"
                        : "text-text-muted hover:text-text-primary hover:bg-white/[0.03]"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                      <span className="text-[13px] truncate">{conv.title}</span>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-white/[0.04] flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-white/[0.04] transition-all"
            >
              {showSidebar ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
            <span className="text-[13px] font-medium text-text-muted">
              {conversationId ? "Conversation" : "New chat"}
            </span>
          </div>
          {metadata && !isStreaming && (
            <div className="flex items-center gap-2">
              <Badge size="sm" variant="default">
                <Clock className="w-3 h-3" />
                {metadata.latency_ms}ms
              </Badge>
              <Badge size="sm" variant="default">
                {metadata.model}
              </Badge>
              {metadata.cache_hit && (
                <Badge size="sm" variant="success">
                  <Zap className="w-3 h-3" />
                  Cached
                </Badge>
              )}
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
                transition={{ duration: 0.5 }}
                className="text-center max-w-md"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-accent/10 to-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-7 border border-accent/[0.1]">
                  <Sparkles className="w-7 h-7 text-accent/70" />
                </div>
                <h2 className="text-xl font-semibold mb-3 tracking-tight">
                  Ask anything about your documents
                </h2>
                <p className="text-text-muted text-sm leading-relaxed mb-10">
                  AI-powered semantic search finds the most relevant
                  passages and provides cited answers.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    "What are the key findings?",
                    "Summarize the main topics",
                    "Compare the documents",
                    "What are the recommendations?",
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
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
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
              className="px-4 md:px-6 pb-2"
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
                placeholder="Ask about your documents..."
                rows={1}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 resize-none transition-all duration-300"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="p-3 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 shadow-[0_0_15px_-3px_rgba(139,124,246,0.25)]"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <p className="text-center text-[11px] text-text-muted/50 mt-3 max-w-3xl mx-auto">
            AI-powered document Q&A with source citations. Always verify critical information.
          </p>
        </div>
      </div>
    </div>
  );
}
