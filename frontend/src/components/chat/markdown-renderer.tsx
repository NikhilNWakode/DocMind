"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Check, Copy, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-border bg-[#0d0d0e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs text-text-muted font-mono">
            {language || "plaintext"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="px-4 py-3 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-[13px] text-text-primary">{children}</code>
      </pre>
    </div>
  );
}

const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming = false,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn("prose-chat", isStreaming && "streaming-cursor", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const isInline = !match && !String(children).includes("\n");

            if (isInline) {
              return (
                <code
                  className="bg-surface border border-border rounded px-1.5 py-0.5 text-[13px] font-mono text-accent"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match?.[1]}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="text-sm leading-[1.75] mb-3 text-text-primary">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mt-6 mb-3">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-semibold mt-5 mb-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm leading-relaxed text-text-primary">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-3 border-accent pl-4 my-3 text-text-secondary italic">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-surface border-b border-border">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="px-4 py-2.5 text-sm border-t border-border">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors"
              >
                {children}
              </a>
            );
          },
          hr() {
            return <hr className="my-4 border-border" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-text-primary">{children}</strong>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export { MarkdownRenderer };
