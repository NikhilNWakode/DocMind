"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  LogOut,
  FolderOpen,
  MessageSquare,
  Search,
  BarChart3,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const workspaceId = params?.id as string | undefined;

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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Loading DocMind...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const navItems = [
    {
      href: "/workspaces",
      icon: FolderOpen,
      label: "Workspaces",
      active: pathname === "/workspaces",
    },
    ...(workspaceId
      ? [
          {
            href: `/workspaces/${workspaceId}`,
            icon: FolderOpen,
            label: "Documents",
            active: pathname === `/workspaces/${workspaceId}`,
          },
          {
            href: `/workspaces/${workspaceId}/chat`,
            icon: MessageSquare,
            label: "Chat",
            active: pathname === `/workspaces/${workspaceId}/chat`,
          },
          {
            href: `/workspaces/${workspaceId}/search`,
            icon: Search,
            label: "Search",
            active: pathname === `/workspaces/${workspaceId}/search`,
          },
          {
            href: `/workspaces/${workspaceId}/analytics`,
            icon: BarChart3,
            label: "Analytics",
            active: pathname === `/workspaces/${workspaceId}/analytics`,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 60 : 220 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex h-screen sticky top-0 flex-col border-r border-border bg-surface/50 overflow-hidden"
      >
        {/* Logo area */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Link href="/workspaces" className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-sm whitespace-nowrap">DocMind</span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors flex-shrink-0"
          >
            {sidebarCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
                  item.active
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            return sidebarCollapsed ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              <div key={item.href}>{link}</div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-2 border-t border-border flex-shrink-0">
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg",
              sidebarCollapsed ? "justify-center" : ""
            )}
          >
            <div className="w-7 h-7 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-accent">
                {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium truncate">{user?.full_name}</p>
                  <p className="text-xs text-text-muted truncate">{user?.email}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!sidebarCollapsed && (
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="p-1.5 text-text-muted hover:text-error rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4">
        <Link href="/workspaces" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">DocMind</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-text-secondary hover:text-text-primary"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed inset-0 z-40 bg-background pt-14"
          >
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                      item.active
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
              <hr className="border-border my-3" />
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:text-error transition-colors w-full"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign out</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
