"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await register(email, password, fullName);
      router.push("/workspaces");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "Upload PDFs, DOCX, TXT, and images",
    "Ask questions in natural language",
    "Get cited answers with source references",
    "Semantic search across all documents",
    "Real-time document processing",
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left side — value props */}
      <div className="hidden lg:flex lg:w-[45%] items-center justify-center p-16 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-surface/40" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-md"
        >
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 bg-gradient-to-br from-accent to-purple-400 rounded-xl flex items-center justify-center shadow-lg shadow-accent/10">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">DocMind</span>
          </div>

          <h2 className="text-3xl font-bold mb-3 leading-tight tracking-tight">
            Build your
            <br />
            <span className="gradient-text">AI knowledge base</span>
          </h2>

          <p className="text-text-secondary text-[15px] mb-10 leading-relaxed">
            Transform documents into an intelligent, searchable knowledge base powered by AI.
          </p>

          <div className="space-y-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                </div>
                <span className="text-sm text-text-secondary">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right side — register form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-8 relative">
        <div className="absolute inset-0 pointer-events-none lg:hidden">
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/[0.03] rounded-full blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-[380px] relative"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 bg-gradient-to-br from-accent to-purple-400 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">DocMind</span>
          </div>

          <h1 className="text-[28px] font-bold tracking-tight mb-2">Create account</h1>
          <p className="text-text-secondary text-[15px] mb-9">
            Get started with your AI document workspace
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-error/[0.06] border border-error/[0.12] text-error rounded-xl px-4 py-3 mb-7 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">
                Full name
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">
                Email address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>

            <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
              Create account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center text-text-muted text-sm mt-8">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-accent hover:text-accent-hover font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
