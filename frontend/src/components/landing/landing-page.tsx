"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Upload,
  Brain,
  Search,
  MessageSquare,
  FileText,
  Database,
  Sparkles,
  Zap,
  Shield,
  Layers,
} from "lucide-react";

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay }}
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
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -40]);

  const features = [
    {
      icon: <Brain className="w-5 h-5" />,
      title: "Semantic Understanding",
      description: "Dense vector search powered by state-of-the-art embedding models understands meaning, not just keywords.",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Streaming Responses",
      description: "Token-by-token streaming with real-time citations. Answers appear instantly as they're generated.",
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Conversational Memory",
      description: "Multi-turn conversations with full context. Ask follow-up questions naturally.",
    },
    {
      icon: <Search className="w-5 h-5" />,
      title: "Document Search",
      description: "Natural language search across your entire document corpus with contextual snippets.",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Source Citations",
      description: "Every answer is grounded in your documents. See exactly which page and passage was referenced.",
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: "Real-Time Processing",
      description: "Watch documents flow through the pipeline — extraction, chunking, embedding, indexing — all live.",
    },
  ];

  const pipelineSteps = [
    { icon: <Upload className="w-5 h-5" />, label: "Upload", desc: "PDF, DOCX, TXT, Images" },
    { icon: <FileText className="w-5 h-5" />, label: "Extract", desc: "OCR + text parsing" },
    { icon: <Layers className="w-5 h-5" />, label: "Chunk", desc: "Semantic splitting" },
    { icon: <Brain className="w-5 h-5" />, label: "Embed", desc: "Vector embeddings" },
    { icon: <Database className="w-5 h-5" />, label: "Index", desc: "Qdrant storage" },
    { icon: <Sparkles className="w-5 h-5" />, label: "Query", desc: "AI-powered Q&A" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto h-16 flex items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-purple-400 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">DocMind</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-300"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium rounded-full border border-accent/20 transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative pt-40 pb-32 px-6"
      >
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/[0.04] rounded-full blur-[150px]" />
          <div className="absolute top-[25%] left-[30%] w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[120px]" />
          <div className="absolute top-[20%] right-[25%] w-[300px] h-[300px] bg-indigo-400/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 15, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent/[0.06] border border-accent/[0.1] rounded-full text-xs font-medium text-accent/80 mb-8"
          >
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            AI Document Intelligence Platform
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-bold leading-[1.05] tracking-[-0.035em] mb-7"
          >
            Your documents,
            <br />
            <span className="bg-gradient-to-r from-accent via-purple-300 to-accent bg-clip-text text-transparent bg-[length:200%_auto] animate-none">
              understood.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-lg md:text-xl text-text-secondary max-w-xl mx-auto mb-12 leading-relaxed font-light"
          >
            Upload any document. Ask questions in plain language.
            Get precise, cited answers in seconds.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-full transition-all duration-300 shadow-[0_0_30px_-5px_rgba(139,124,246,0.3)] hover:shadow-[0_0_40px_-5px_rgba(139,124,246,0.45)] hover:-translate-y-0.5"
            >
              Start for free
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-text-secondary hover:text-text-primary font-medium rounded-full border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02] transition-all duration-300"
            >
              How it works
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Features */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <p className="text-accent/70 text-sm font-medium tracking-wider uppercase mb-4">Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
              Everything you need to understand
              <br className="hidden md:block" />
              your documents deeply
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto text-base leading-relaxed">
              A complete RAG pipeline built for accuracy and speed.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/50 rounded-2xl overflow-hidden border border-border/50">
            {features.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.05}>
                <div className="h-full p-8 bg-background hover:bg-surface-hover/40 transition-colors duration-500 group">
                  <div className="w-10 h-10 rounded-xl bg-accent/[0.07] flex items-center justify-center text-accent mb-5 group-hover:bg-accent/[0.12] transition-colors duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-[15px] mb-2.5 tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-20">
            <p className="text-accent/70 text-sm font-medium tracking-wider uppercase mb-4">Pipeline</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
              From upload to insight
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              Documents flow through a multi-stage pipeline with real-time progress.
            </p>
          </AnimatedSection>

          <AnimatedSection>
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
              {/* Connection line */}
              <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              {pipelineSteps.map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="relative flex flex-col items-center gap-3 z-10"
                >
                  <div className="w-14 h-14 bg-surface border border-border rounded-2xl flex items-center justify-center text-accent shadow-lg shadow-black/20">
                    {step.icon}
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium block">{step.label}</span>
                    <span className="text-xs text-text-muted">{step.desc}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6">
        <AnimatedSection className="max-w-2xl mx-auto text-center">
          <div className="relative p-14 rounded-3xl border border-border/50 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-accent/[0.06] rounded-full blur-[80px]" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Ready to begin?
              </h2>
              <p className="text-text-secondary mb-10 max-w-sm mx-auto leading-relaxed">
                Transform your documents into an intelligent knowledge base in minutes.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-8 py-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-full transition-all duration-300 shadow-[0_0_30px_-5px_rgba(139,124,246,0.3)] hover:shadow-[0_0_40px_-5px_rgba(139,124,246,0.45)] hover:-translate-y-0.5"
              >
                Create free account
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-gradient-to-br from-accent to-purple-400 rounded-md flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold">DocMind</span>
          </div>
          <p className="text-xs text-text-muted">
            Built with FastAPI, Next.js, Qdrant & Groq
          </p>
        </div>
      </footer>
    </div>
  );
}
