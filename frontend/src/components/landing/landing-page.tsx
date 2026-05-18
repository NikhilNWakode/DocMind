"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  Sparkles,
  Upload,
  Brain,
  Search,
  MessageSquare,
  Zap,
  Shield,
  Layers,
  ArrowRight,
  FileText,
  Database,
  CheckCircle2,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
};

function AnimatedSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  const features = [
    {
      icon: <Brain className="w-5 h-5" />,
      title: "Hybrid RAG Pipeline",
      description: "Dense vectors + BM25 sparse search with Reciprocal Rank Fusion for superior retrieval accuracy.",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Cross-Encoder Reranking",
      description: "Neural reranking with ms-marco models elevates the most relevant passages to the top.",
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Streaming AI Responses",
      description: "Token-by-token streaming with citations, powered by Llama 3.3 70B with conversation memory.",
    },
    {
      icon: <Search className="w-5 h-5" />,
      title: "Semantic Search",
      description: "Natural language search across your entire document corpus with contextual snippets.",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Semantic Caching",
      description: "Intelligent cache with cosine similarity matching. Instant responses for similar queries.",
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: "Real-Time Processing",
      description: "Celery workers with progress streaming. Watch your documents get parsed, chunked, and indexed live.",
    },
  ];

  const techStack = [
    { name: "FastAPI", category: "Backend" },
    { name: "Next.js 15", category: "Frontend" },
    { name: "PostgreSQL", category: "Database" },
    { name: "Qdrant", category: "Vector DB" },
    { name: "Redis", category: "Cache/Queue" },
    { name: "Celery", category: "Workers" },
    { name: "Llama 3.3 70B", category: "LLM" },
    { name: "MinIO (S3)", category: "Storage" },
  ];

  const pipelineSteps = [
    { icon: <Upload className="w-5 h-5" />, label: "Upload", desc: "PDF, DOCX, TXT, Images" },
    { icon: <FileText className="w-5 h-5" />, label: "Extract", desc: "OCR + Structure parsing" },
    { icon: <Layers className="w-5 h-5" />, label: "Chunk", desc: "Semantic splitting" },
    { icon: <Brain className="w-5 h-5" />, label: "Embed", desc: "MiniLM-L6-v2 vectors" },
    { icon: <Database className="w-5 h-5" />, label: "Index", desc: "Qdrant storage" },
    { icon: <Sparkles className="w-5 h-5" />, label: "Query", desc: "Hybrid + Reranking" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">DocMind</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-32 pb-20 px-6"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            {...fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-xs font-medium text-accent mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Production-Grade RAG Platform
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            AI-Powered
            <br />
            <span className="bg-gradient-to-r from-accent via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Document Intelligence
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Upload documents, ask questions in natural language, get instant AI-generated answers
            with citations. Hybrid retrieval with cross-encoder reranking for enterprise-grade accuracy.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
            >
              Start Building
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#architecture"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-light font-medium rounded-xl transition-all"
            >
              View Architecture
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Enterprise-Grade AI Features
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Built with production best practices — not a demo, but a real platform you can deploy.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <AnimatedSection key={feature.title}>
                <motion.div
                  whileHover={{ y: -4, borderColor: "rgba(59, 130, 246, 0.3)" }}
                  transition={{ duration: 0.2 }}
                  className="h-full p-6 bg-surface border border-border rounded-2xl"
                >
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Architecture */}
      <section id="architecture" className="py-24 px-6 bg-surface/30">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ingestion Pipeline
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Documents flow through a multi-stage async pipeline with real-time progress tracking.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <div className="flex flex-col md:flex-row items-center justify-between gap-2">
              {pipelineSteps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col items-center gap-2 p-4 min-w-[120px]"
                  >
                    <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center text-accent">
                      {step.icon}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-xs text-text-muted text-center">{step.desc}</span>
                  </motion.div>
                  {i < pipelineSteps.length - 1 && (
                    <div className="hidden md:block w-8 h-px bg-border" />
                  )}
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built With Modern Stack
            </h2>
          </AnimatedSection>

          <AnimatedSection>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {techStack.map((tech) => (
                <motion.div
                  key={tech.name}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="p-4 bg-surface border border-border rounded-xl text-center"
                >
                  <p className="font-semibold text-sm">{tech.name}</p>
                  <p className="text-xs text-text-muted mt-1">{tech.category}</p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <AnimatedSection className="max-w-3xl mx-auto text-center">
          <div className="p-12 bg-surface border border-border rounded-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5" />
            <div className="relative">
              <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                Transform your documents into an intelligent knowledge base in minutes.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold">DocMind</span>
          </div>
          <p className="text-xs text-text-muted">
            Built with FastAPI, Next.js, Qdrant, and Groq
          </p>
        </div>
      </footer>
    </div>
  );
}
