"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  FolderOpen,
  MessageSquare,
  Search,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface SidebarProps {
  workspaceId?: string;
}

function Sidebar({ workspaceId }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const mainNavItems = [
    {
      href: "/workspaces",
      icon: FolderOpen,
      label: "Workspaces",
    },
    ...(workspaceId
      ? [
          {
            href: `/workspaces/${workspaceId}`,
            icon: FolderOpen,
            label: "Documents",
          },
          {
            href: `/workspaces/${workspaceId}/chat`,
            icon: MessageSquare,
            label: "Chat",
          },
          {
            href: `/workspaces/${workspaceId}/search`,
            icon: Search,
            label: "Search",
          },
          {
            href: `/workspaces/${workspaceId}/analytics`,
            icon: BarChart3,
            label: "Analytics",
          },
        ]
      : []),
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-full border-r border-border bg-surface/50 flex flex-col overflow-hidden"
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm whitespace-nowrap">DocMind</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
        >
          {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>
    </motion.aside>
  );
}

export { Sidebar };
