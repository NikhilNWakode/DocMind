import { create } from "zustand";
import { api, User } from "@/lib/api";

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  loadUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    await api.login(email, password);
    const user = await api.getMe();
    set({ user, isAuthenticated: true });
  },

  register: async (email, password, fullName) => {
    await api.register(email, password, fullName);
    await api.login(email, password);
    const user = await api.getMe();
    set({ user, isAuthenticated: true });
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Add timeout for slow cold starts (Render free tier)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const user = await api.getMe();
        set({ user, isAuthenticated: true, isLoading: false });
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      api.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    api.clearTokens();
    set({ user: null, isAuthenticated: false });
  },
}));
