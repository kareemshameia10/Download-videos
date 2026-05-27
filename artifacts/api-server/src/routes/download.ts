import { Router } from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import os from "os";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver") as typeof import("archiver").default;
import { logger } from "../lib/logger";
import {
  GetMediaInfoBody,
  StartDownloadBody,
  GetDownloadStatusParams,
  DownloadFileParams,
} from "@workspace/api-zod";

const router = Router();

interface Job {
  jobId: string;
  status: "pending" | "downloading" | "zipping" | "done" | "error";
  progress: number | null;
  error: string | null;
  filename: string | null;
  zipPath: string | null;
  createdAt: string;
  tmpDir: string | null;
}

const jobs = new Map<string, Job>();

function cleanupJob(job: Job, delayMs = 30 * 60 * 1000) {
  setTimeout(() => {
    if (job.tmpDir && fs.existsSync(job.tmpDir)) {
      fs.rmSync(job.tmpDir, { recursive: true, force: true });
    }
    jobs.delete(job.jobId);
  }, delayMs);
}

function getPlatform(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("twitter.com") || url.includes("x.com")) return "Twitter/X";
  if (url.includes("facebook.com") || url.includes("fb.watch")) return "Facebook";
  if (url.includes("reddit.com")) return "Reddit";
  if (url.includes("twitch.tv")) return "Twitch";
  if (url.includes("vimeo.com")) return "Vimeo";
  if (url.includes("dailymotion.com")) return "Dailymotion";
  return "Web";
}

function spawnYtDlp(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

router.post("/download/info", async (req, res) => {
  const parsed = GetMediaInfoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { url } = parsed.data;

  req.log.info({ url }, "Fetching media info");

  const { stdout, stderr, code } = await spawnYtDlp([
    "--dump-json",
    "--no-playlist",
    "--no-warnings",
    url,
  ]);

  if (code !== 0) {
    req.log.warn({ stderr, url }, "yt-dlp info failed");
    res.status(400).json({ error: "Could not fetch media info. Make sure the URL is valid and publicly accessible." });
    return;
  }

  let info: Record<string, unknown>;
  try {
    info = JSON.parse(stdout.trim());
  } catch {
    res.status(500).json({ error: "Failed to parse media info" });
    return;
  }

  const rawFormats = (info.formats as Array<Record<string, unknown>> | undefined) ?? [];

  interface FormatEntry {
    formatId: string;
    quality: string;
    ext: string;
    filesize: number | null;
    vcodec: string | null;
    acodec: string | null;
    resolution: string | null;
  }

  const seen = new Set<string>();
  const formats: FormatEntry[] = [];

  for (const f of rawFormats) {
    const formatId = String(f.format_id ?? "");
    const ext = String(f.ext ?? "mp4");
    const vcodec = f.vcodec && f.vcodec !== "none" ? String(f.vcodec) : null;
    const acodec = f.acodec && f.acodec !== "none" ? String(f.acodec) : null;
    const height = f.height ? Number(f.height) : null;
    const resolution = f.resolution ? String(f.resolution) : height ? `${height}p` : null;
    const filesize =
      f.filesize != null
        ? Number(f.filesize)
        : f.filesize_approx != null
        ? Number(f.filesize_approx)
        : null;

    let quality = "";
    if (height) {
      quality = `${height}p`;
    } else if (!vcodec && acodec) {
      quality = "Audio only";
    } else if (f.format_note) {
      quality = String(f.format_note);
    } else {
      quality = formatId;
    }

    const key = `${quality}-${ext}`;
    if (!seen.has(key)) {
      seen.add(key);
      formats.push({ formatId, quality, ext, filesize, vcodec, acodec, resolution });
    }
  }

  if (formats.length === 0) {
    formats.push({
      formatId: "best",
      quality: "Best",
      ext: "mp4",
      filesize: null,
      vcodec: null,
      acodec: null,
      resolution: null,
    });
  }

  formats.sort((a, b) => {
    const aH = parseInt(a.quality) || 0;
    const bH = parseInt(b.quality) || 0;
    return bH - aH;
  });

  res.json({
    title: String(info.title ?? "Unknown"),
    thumbnail: info.thumbnail ? String(info.thumbnail) : null,
    platform: getPlatform(url),
    duration: info.duration != null ? Number(info.duration) : null,
    formats,
  });
});

router.post("/download/start", async (req, res) => {
  const parsed = StartDownloadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { url, formatId, title } = parsed.data;

  const jobId = randomUUID();
  const tmpDir = path.join(os.tmpdir(), `mediagrab-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const job: Job = {
    jobId,
    status: "pending",
    progress: 0,
    error: null,
    filename: null,
    zipPath: null,
    createdAt: new Date().toISOString(),
    tmpDir,
  };
  jobs.set(jobId, job);

  res.status(202).json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    error: job.error,
    filename: job.filename,
    createdAt: job.createdAt,
  });

  (async () => {
    try {
      job.status = "downloading";
      job.progress = 5;

      const outputTemplate = path.join(tmpDir, "%(title)s.%(ext)s");
      const args = [
        "-f",
        formatId === "best" ? "bestvideo+bestaudio/best" : formatId,
        "--merge-output-format",
        "mp4",
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "-o",
        outputTemplate,
        url,
      ];

      await new Promise<void>((resolve, reject) => {
        const proc = spawn("yt-dlp", args);

        proc.stdout.on("data", (chunk: Buffer) => {
          const line = chunk.toString();
          const match = line.match(/(\d+\.?\d*)%/);
          if (match) {
            job.progress = Math.min(90, Math.round(parseFloat(match[1])));
          }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
          logger.warn({ msg: chunk.toString().trim() }, "yt-dlp stderr");
        });

        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`yt-dlp exited with code ${code}`));
        });
      });

      job.status = "zipping";
      job.progress = 92;

      const files = fs.readdirSync(tmpDir).filter((f) => !f.endsWith(".zip"));
      const safeTitle = (title ?? "media")
        .replace(/[^a-zA-Z0-9\u0600-\u06FF\s._-]/g, "")
        .trim()
        .substring(0, 60) || "media";
      const zipName = `${safeTitle}.zip`;
      const zipPath = path.join(tmpDir, zipName);

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 6 } });

        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);

        for (const file of files) {
          archive.file(path.join(tmpDir, file), { name: file });
        }
        archive.finalize();
      });

      job.status = "done";
      job.progress = 100;
      job.filename = zipName;
      job.zipPath = zipPath;

      cleanupJob(job);
      logger.info({ jobId }, "Download job completed");
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error";
      cleanupJob(job, 5 * 60 * 1000);
      logger.error({ jobId, err }, "Download job failed");
    }
  })();
});

router.get("/download/:jobId/status", (req, res) => {
  const parsed = GetDownloadStatusParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }
  const { jobId } = parsed.data;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    error: job.error,
    filename: job.filename,
    createdAt: job.createdAt,
  });
});

router.get("/download/:jobId/file", (req, res) => {
  const parsed = DownloadFileParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid job ID" });
    return;
  }
  const { jobId } = parsed.data;
  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "done" || !job.zipPath) {
    res.status(404).json({ error: "File not ready yet" });
    return;
  }
  if (!fs.existsSync(job.zipPath)) {
    res.status(404).json({ error: "File no longer available" });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(job.filename ?? "media.zip")}"`
  );
  const stream = fs.createReadStream(job.zipPath);
  stream.pipe(res);
});

export default router;
