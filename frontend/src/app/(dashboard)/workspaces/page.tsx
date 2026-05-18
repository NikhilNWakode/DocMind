"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, Workspace } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Organize your documents into knowledge bases
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New workspace
        </Button>
      </motion.div>

      {/* Create workspace dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogTitle>Create workspace</DialogTitle>
        <DialogDescription>
          Workspaces help you organize documents by project, topic, or team.
        </DialogDescription>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
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
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
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

      {/* Workspace grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20 bg-surface/30 rounded-2xl border border-border/50"
        >
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
          <p className="text-text-secondary mb-6 text-sm max-w-sm mx-auto">
            Create your first workspace to start uploading and querying documents
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Create workspace
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws, i) => (
            <motion.div
              key={ws.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/workspaces/${ws.id}`)}
              className="bg-surface border border-border rounded-xl p-5 cursor-pointer hover:border-accent/40 hover:bg-surface-hover transition-all duration-200 group relative overflow-hidden"
            >
              {/* Hover accent glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <FolderOpen className="w-5 h-5 text-accent" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>

                <h3 className="font-semibold mb-1 group-hover:text-accent transition-colors">
                  {ws.name}
                </h3>
                {ws.description && (
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                    {ws.description}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <Badge variant="default" size="sm">
                    <FileText className="w-3 h-3" />
                    {ws.document_count} docs
                  </Badge>
                  <span className="text-xs text-text-muted flex items-center gap-1">
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
