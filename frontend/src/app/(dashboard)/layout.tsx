"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="w-10 h-10 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-white/[0.04] glass flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-purple-400 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight">DocMind</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent/[0.08] rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-accent">
                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <span className="text-[13px] text-text-secondary hidden sm:block">
              {user?.full_name}
            </span>
          </div>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="p-2 text-text-muted hover:text-error rounded-lg hover:bg-white/[0.04] transition-all"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
