"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/[0.03] rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[380px] relative"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 bg-gradient-to-br from-accent to-purple-400 rounded-xl flex items-center justify-center shadow-lg shadow-accent/10">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">DocMind</span>
        </div>

        {/* Header */}
        <h1 className="text-[28px] font-bold tracking-tight mb-2">Welcome back</h1>
        <p className="text-text-secondary text-[15px] mb-9">
          Sign in to continue to your workspace
        </p>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-error/[0.06] border border-error/[0.12] text-error rounded-xl px-4 py-3 mb-7 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="Enter your password"
              required
            />
          </div>

          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            Sign in
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        <p className="text-center text-text-muted text-sm mt-8">
          No account yet?{" "}
          <Link
            href="/register"
            className="text-accent hover:text-accent-hover font-medium transition-colors"
          >
            Create one
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
