import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function getFileTypeIcon(fileType: string): string {
  switch (fileType) {
    case "pdf":
      return "📄";
    case "docx":
      return "📝";
    case "txt":
      return "📃";
    case "png":
    case "jpg":
    case "jpeg":
      return "🖼️";
    default:
      return "📎";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "indexed":
      return "text-success";
    case "processing":
      return "text-warning";
    case "failed":
      return "text-error";
    case "pending":
      return "text-text-muted";
    default:
      return "text-text-secondary";
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}
