import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number | null | undefined, decimals = 2) {
  if (bytes == null) return "Unknown size";
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function getPlatformInfo(url: string) {
  try {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
      return { name: "YouTube", color: "bg-[#FF0000] text-white border-red-500/20 shadow-[0_0_10px_rgba(255,0,0,0.2)]" };
    }
    if (lowerUrl.includes("tiktok.com")) {
      return { name: "TikTok", color: "bg-[#00f2fe] text-black font-semibold border-cyan-400/20 shadow-[0_0_10px_rgba(0,242,254,0.2)]" };
    }
    if (lowerUrl.includes("instagram.com")) {
      return { name: "Instagram", color: "bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white border-pink-500/20 shadow-[0_0_10px_rgba(230,104,60,0.2)]" };
    }
    if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com")) {
      return { name: "X/Twitter", color: "bg-blue-500 text-white border-blue-400/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]" };
    }
    if (lowerUrl.includes("facebook.com") || lowerUrl.includes("fb.watch")) {
      return { name: "Facebook", color: "bg-blue-600 text-white border-blue-500/20 shadow-[0_0_10px_rgba(37,99,235,0.2)]" };
    }
  } catch (e) {
    // URL parsing might fail
  }
  return { name: "Web", color: "bg-zinc-700 text-zinc-100 border-zinc-600/50 shadow-none" };
}

export function getFormatLabel(format: any) {
  const parts = [];
  if (format.resolution) parts.push(format.resolution);
  if (format.vcodec && format.vcodec !== "none") parts.push("Video");
  if (format.acodec && format.acodec !== "none" && (!format.vcodec || format.vcodec === "none")) parts.push("Audio Only");
  if (format.ext) parts.push(format.ext.toUpperCase());
  if (parts.length === 0) return format.quality || "Unknown format";
  return parts.join(" ");
}