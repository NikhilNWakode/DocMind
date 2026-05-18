"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chat";
import { api, Conversation, Citation } from "@/lib/api";
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

  // Load conversations list
  useEffect(() => {
    api.listConversations(workspaceId).then((data) => {
      setConversations(data.conversations);
    });
  }, [workspaceId, conversationId]);

  // Auto-scroll to bottom
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
            transition={{ duration: 0.2 }}
            className="border-r border-border bg-surface/50 flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-border flex-shrink-0">
              <button
                onClick={clearChat}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface-hover hover:bg-border/30 rounded-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                New chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {conversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-xs text-text-muted">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                      conversationId === conv.id
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-sm truncate">{conv.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-error rounded transition-all flex-shrink-0"
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
        {/* Chat header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-surface/30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-hover transition-colors"
            >
              {showSidebar ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
            <span className="text-sm font-medium text-text-secondary">
              {conversationId ? "Conversation" : "New chat"}
            </span>
          </div>
          {metadata && !isStreaming && (
            <div className="flex items-center gap-3">
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
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center max-w-lg"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-accent/20">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  Ask anything about your documents
                </h2>
                <p className="text-text-secondary text-sm leading-relaxed mb-8">
                  I use hybrid retrieval with cross-encoder reranking to find the most relevant
                  information and provide cited answers.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {[
                    "What are the key findings?",
                    "Summarize the main topics",
                    "Compare the documents",
                    "What are the recommendations?",
                  ].map((suggestion) => (
                    <motion.button
                      key={suggestion}
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setInput(suggestion)}
                      className="px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:text-text-primary hover:border-accent/30 transition-all text-left"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/10 to-purple-500/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-accent" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] md:max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-accent text-white rounded-2xl rounded-br-md px-4 py-3"
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
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-text-secondary" />
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
              <div className="max-w-3xl mx-auto bg-error/10 border border-error/20 text-error rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Citations panel */}
        <CitationPanel citations={citations} />

        {/* Input */}
        <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
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
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none transition-all"
              />
            </div>
            <motion.button
              type="submit"
              disabled={!input.trim() || isStreaming}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="p-3 bg-accent hover:bg-accent-hover text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-sm shadow-accent/20"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </form>
          <p className="text-center text-[11px] text-text-muted mt-2.5 max-w-3xl mx-auto">
            Hybrid RAG with reranking. Responses cite source documents. Always verify critical info.
          </p>
        </div>
      </div>
    </div>
  );
}
