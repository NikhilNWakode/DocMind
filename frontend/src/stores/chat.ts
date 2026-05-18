import { create } from "zustand";
import { api, ChatMessage, ChatMetadata, Citation } from "@/lib/api";

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  citations: Citation[];
  conversationId: string | null;
  metadata: ChatMetadata | null;
  error: string | null;

  sendMessage: (query: string, workspaceId: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  clearChat: () => void;
  setConversationId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isStreaming: false,
  citations: [],
  conversationId: null,
  metadata: null,
  error: null,

  sendMessage: async (query, workspaceId) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      citations: null,
      model: null,
      created_at: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      citations: null,
      model: null,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMessage, assistantMessage],
      isStreaming: true,
      error: null,
      citations: [],
      metadata: null,
    }));

    const currentConvId = get().conversationId;

    await api.streamChat(
      query,
      workspaceId,
      currentConvId || undefined,
      // onToken
      (token) => {
        set((s) => {
          const messages = [...s.messages];
          const last = messages[messages.length - 1];
          if (last && last.role === "assistant") {
            messages[messages.length - 1] = { ...last, content: last.content + token };
          }
          return { messages };
        });
      },
      // onCitations
      (citations) => {
        set({ citations });
      },
      // onMetadata
      (metadata) => {
        set((s) => {
          const messages = [...s.messages];
          const last = messages[messages.length - 1];
          if (last && last.role === "assistant") {
            messages[messages.length - 1] = { ...last, model: metadata.model };
          }
          return { messages, metadata };
        });
      },
      // onStart
      (conversationId) => {
        set({ conversationId });
      },
      // onDone
      () => {
        set({ isStreaming: false });
      },
      // onError
      (error) => {
        set({ isStreaming: false, error });
      }
    );
  },

  loadConversation: async (conversationId) => {
    const data = await api.getConversationMessages(conversationId);
    set({
      messages: data.messages,
      conversationId,
      citations: [],
      metadata: null,
      error: null,
    });
  },

  clearChat: () => {
    set({
      messages: [],
      conversationId: null,
      citations: [],
      metadata: null,
      error: null,
      isStreaming: false,
    });
  },

  setConversationId: (id) => set({ conversationId: id }),
}));
