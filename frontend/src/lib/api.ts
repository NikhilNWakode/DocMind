/**
 * API client for DocMind backend — Phase 2.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  setToken(token: string): void {
    localStorage.setItem("access_token", token);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem("refresh_token", token);
  }

  clearTokens(): void {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const token = this.getToken();
    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }

    if (body && !(body instanceof FormData)) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      // FastAPI validation errors return {detail: [{msg, loc, type}]}
      let message = "Unknown error";
      if (error.detail && Array.isArray(error.detail)) {
        message = error.detail
          .map((d: { msg: string; loc?: string[] }) => {
            const field = d.loc?.slice(-1)[0] || "";
            return field ? `${field}: ${d.msg}` : d.msg;
          })
          .join(", ");
      } else {
        message = error.detail || error.message || error.error || "Unknown error";
      }
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, fullName: string) {
    return this.request("/auth/register", {
      method: "POST",
      body: { email, password, full_name: fullName },
    });
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      access_token: string;
      refresh_token: string;
    }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    this.setToken(data.access_token);
    this.setRefreshToken(data.refresh_token);
    return data;
  }

  async getMe() {
    return this.request<User>("/auth/me");
  }

  // Workspaces
  async createWorkspace(name: string, description?: string) {
    return this.request<Workspace>("/workspaces", {
      method: "POST",
      body: { name, description },
    });
  }

  async listWorkspaces() {
    return this.request<{ workspaces: Workspace[]; total: number }>("/workspaces");
  }

  // Documents
  async uploadDocument(workspaceId: string, file: File) {
    const formData = new FormData();
    formData.append("workspace_id", workspaceId);
    formData.append("file", file);
    return this.request<Document>("/documents/upload", {
      method: "POST",
      body: formData,
    });
  }

  async listDocuments(workspaceId: string) {
    return this.request<{ documents: Document[]; total: number }>(
      `/documents?workspace_id=${workspaceId}`
    );
  }

  async getDocumentStatus(docId: string) {
    return this.request<DocumentStatus>(`/documents/${docId}/status`);
  }

  async deleteDocument(id: string) {
    return this.request(`/documents/${id}`, { method: "DELETE" });
  }

  // Ingestion progress (SSE)
  streamIngestionProgress(
    docId: string,
    onProgress?: (data: IngestionProgress) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): () => void {
    const token = this.getToken();
    const eventSource = new EventSource(
      `${this.baseUrl}/api/v1/ingestion/${docId}/progress`
    );

    // EventSource doesn't support custom headers, so we use fetch-based SSE
    let aborted = false;
    const controller = new AbortController();

    const run = async () => {
      try {
        const response = await fetch(
          `${this.baseUrl}/api/v1/ingestion/${docId}/progress`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          onError?.("Failed to connect to progress stream");
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as IngestionProgress;
              onProgress?.(data);
              if (data.stage === "complete" || data.stage === "failed") {
                onComplete?.();
                return;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if (!aborted) {
          onError?.(String(err));
        }
      }
    };

    run();

    // Return cleanup function
    return () => {
      aborted = true;
      controller.abort();
    };
  }

  // Chat (streaming via SSE)
  async streamChat(
    query: string,
    workspaceId: string,
    conversationId?: string,
    onToken?: (token: string) => void,
    onCitations?: (citations: Citation[]) => void,
    onMetadata?: (metadata: ChatMetadata) => void,
    onStart?: (conversationId: string) => void,
    onDone?: () => void,
    onError?: (error: string) => void,
    documentId?: string
  ) {
    const token = this.getToken();
    const body: Record<string, unknown> = {
      query,
      workspace_id: workspaceId,
    };
    if (conversationId) body.conversation_id = conversationId;
    if (documentId) body.document_id = documentId;

    const response = await fetch(`${this.baseUrl}/api/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Stream failed" }));
      onError?.(error.message);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          switch (data.type) {
            case "start":
              onStart?.(data.conversation_id);
              break;
            case "token":
              onToken?.(data.content);
              break;
            case "citations":
              onCitations?.(data.citations);
              break;
            case "metadata":
              onMetadata?.(data);
              break;
            case "done":
              onDone?.();
              break;
            case "error":
              onError?.(data.content || data.message);
              break;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  // Conversations
  async listConversations(workspaceId: string) {
    return this.request<{ conversations: Conversation[]; total: number }>(
      `/chat/conversations?workspace_id=${workspaceId}`
    );
  }

  async getConversationMessages(conversationId: string) {
    return this.request<{ messages: ChatMessage[] }>(
      `/chat/conversations/${conversationId}/messages`
    );
  }

  async deleteConversation(id: string) {
    return this.request(`/chat/conversations/${id}`, { method: "DELETE" });
  }

}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  file_type: string;
  file_size: number;
  page_count: number | null;
  status: string;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentStatus {
  id: string;
  status: string;
  chunk_count: number;
  error_message: string | null;
  progress: IngestionProgress | null;
}

export interface IngestionProgress {
  document_id: string;
  stage: string;
  progress: number;
  message: string;
}

export interface Citation {
  document_title: string;
  document_id: string;
  page_number: number | null;
  chunk_content: string;
  relevance_score: number | null;
}

export interface ChatMetadata {
  model: string;
  latency_ms: number;
  chunks_used: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: { sources: Citation[] } | null;
  model: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  workspace_id: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export const api = new ApiClient(API_URL);
