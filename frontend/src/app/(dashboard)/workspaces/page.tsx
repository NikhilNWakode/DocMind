"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, Workspace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderOpen, FileText, Clock, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const loadWorkspaces = async () => {
    try {
      const data = await api.listWorkspaces();
      setWorkspaces(data.workspaces);
    } catch (err) {
      console.error("Failed to load workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await api.createWorkspace(newName, newDesc || undefined);
      setWorkspaces((prev) => [ws, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create workspace:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-10"
      >
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Workspaces</h1>
          <p className="text-text-muted mt-1.5 text-[15px]">
            Organize your documents into knowledge bases
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New workspace
        </Button>
      </motion.div>

      {/* Create dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogTitle>Create workspace</DialogTitle>
        <DialogDescription>
          Workspaces help you organize documents by project or topic.
        </DialogDescription>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Name
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Research Papers"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Description (optional)
            </label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What kind of documents will this contain?"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={creating}>
              Create workspace
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-24 rounded-2xl border border-white/[0.04]"
        >
          <div className="w-16 h-16 bg-accent/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <FolderOpen className="w-7 h-7 text-accent/60" />
          </div>
          <h3 className="text-lg font-semibold mb-2 tracking-tight">No workspaces yet</h3>
          <p className="text-text-muted mb-8 text-sm max-w-sm mx-auto">
            Create your first workspace to start uploading and querying documents
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Create workspace
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {workspaces.map((ws, i) => (
            <motion.div
              key={ws.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
              onClick={() => router.push(`/workspaces/${ws.id}`)}
              className="group relative p-6 rounded-2xl border border-white/[0.04] hover:border-accent/20 bg-surface/30 hover:bg-surface-hover/40 cursor-pointer transition-all duration-400 overflow-hidden"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 bg-accent/[0.06] rounded-xl flex items-center justify-center group-hover:bg-accent/[0.1] transition-colors duration-400">
                    <FolderOpen className="w-5 h-5 text-accent/70" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all duration-300" />
                </div>

                <h3 className="font-semibold text-[15px] mb-1 tracking-tight group-hover:text-accent transition-colors duration-300">
                  {ws.name}
                </h3>
                {ws.description && (
                  <p className="text-text-muted text-sm mb-5 line-clamp-2 leading-relaxed">
                    {ws.description}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-auto">
                  <Badge variant="default" size="sm">
                    <FileText className="w-3 h-3" />
                    {ws.document_count} docs
                  </Badge>
                  <span className="text-[11px] text-text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(ws.updated_at)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
