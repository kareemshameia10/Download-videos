const express = require('express');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Check yt-dlp is installed
function checkYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get available formats for a URL
app.post('/api/formats', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL مطلوب' });

  if (!checkYtDlp()) {
    return res.status(500).json({ error: 'yt-dlp غير مثبت. شغّل: pip install yt-dlp' });
  }

  exec(`yt-dlp -J --no-playlist "${url}" 2>&1`, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      return res.status(400).json({ error: 'تعذّر جلب معلومات الرابط. تأكد من صحة الرابط.' });
    }

    try {
      const info = JSON.parse(stdout);
      const formats = [];

      // Add combined formats (video+audio)
      if (info.formats) {
        const seen = new Set();
        info.formats
          .filter(f => f.ext && (f.vcodec !== 'none' || f.acodec !== 'none'))
          .forEach(f => {
            const label = f.format_note || f.resolution || f.format_id;
            const key = `${f.ext}-${label}`;
            if (!seen.has(key)) {
              seen.add(key);
              formats.push({
                format_id: f.format_id,
                ext: f.ext,
                label: label || 'غير معروف',
                filesize: f.filesize || f.filesize_approx || null,
                vcodec: f.vcodec,
                acodec: f.acodec,
                hasVideo: f.vcodec !== 'none' && f.vcodec != null,
                hasAudio: f.acodec !== 'none' && f.acodec != null,
              });
            }
          });
      }

      // Add best presets
      const presets = [
        { format_id: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', ext: 'mp4', label: '🏆 أفضل جودة (MP4)', isPreset: true },
        { format_id: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', ext: 'mp4', label: '📺 1080p', isPreset: true },
        { format_id: 'bestvideo[height<=720]+bestaudio/best[height<=720]', ext: 'mp4', label: '📺 720p', isPreset: true },
        { format_id: 'bestvideo[height<=480]+bestaudio/best[height<=480]', ext: 'mp4', label: '📱 480p', isPreset: true },
        { format_id: 'bestaudio[ext=m4a]/bestaudio', ext: 'mp3', label: '🎵 صوت فقط (MP3)', isPreset: true, audioOnly: true },
      ];

      res.json({
        title: info.title || 'بدون عنوان',
        thumbnail: info.thumbnail || null,
        duration: info.duration || null,
        uploader: info.uploader || info.channel || null,
        platform: info.extractor_key || info.extractor || 'غير معروف',
        presets,
        formats: formats.slice(0, 30),
      });
    } catch (parseErr) {
      res.status(400).json({ error: 'تعذّر قراءة معلومات الفيديو.' });
    }
  });
});

// Download media
app.post('/api/download', (req, res) => {
  const { url, format_id, ext, audioOnly } = req.body;
  if (!url || !format_id) return res.status(400).json({ error: 'بيانات ناقصة' });

  if (!checkYtDlp()) {
    return res.status(500).json({ error: 'yt-dlp غير مثبت' });
  }

  const sessionId = uuidv4();
  const sessionDir = path.join(DOWNLOADS_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

  let ytdlpCmd;
  if (audioOnly || ext === 'mp3') {
    ytdlpCmd = `yt-dlp -f "${format_id}" --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${url}"`;
  } else {
    ytdlpCmd = `yt-dlp -f "${format_id}" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
  }

  console.log(`[${sessionId}] Downloading: ${url}`);
  console.log(`[${sessionId}] Command: ${ytdlpCmd}`);

  // Send session ID immediately
  res.json({ sessionId, status: 'started' });

  exec(ytdlpCmd, { timeout: 300000 }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[${sessionId}] Error:`, stderr);
      fs.writeFileSync(path.join(sessionDir, 'error.txt'), stderr || err.message);
    } else {
      console.log(`[${sessionId}] Done!`);
      fs.writeFileSync(path.join(sessionDir, 'done.txt'), 'success');
    }
  });
});

// Check download status
app.get('/api/status/:sessionId', (req, res) => {
  const sessionDir = path.join(DOWNLOADS_DIR, req.params.sessionId);

  if (!fs.existsSync(sessionDir)) {
    return res.json({ status: 'not_found' });
  }

  if (fs.existsSync(path.join(sessionDir, 'error.txt'))) {
    const error = fs.readFileSync(path.join(sessionDir, 'error.txt'), 'utf8');
    return res.json({ status: 'error', error });
  }

  if (fs.existsSync(path.join(sessionDir, 'done.txt'))) {
    return res.json({ status: 'done' });
  }

  return res.json({ status: 'processing' });
});

// Create ZIP and download
app.get('/api/zip/:sessionId', (req, res) => {
  const sessionDir = path.join(DOWNLOADS_DIR, req.params.sessionId);

  if (!fs.existsSync(sessionDir)) {
    return res.status(404).json({ error: 'الجلسة غير موجودة' });
  }

  const files = fs.readdirSync(sessionDir).filter(f => !f.endsWith('.txt'));
  if (files.length === 0) {
    return res.status(404).json({ error: 'لا توجد ملفات للتحميل' });
  }

  const zipName = `mediadown_${req.params.sessionId.slice(0, 8)}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  files.forEach(file => {
    archive.file(path.join(sessionDir, file), { name: file });
  });

  archive.finalize();

  // Cleanup after 10 minutes
  setTimeout(() => {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }, 10 * 60 * 1000);
});

// Cleanup old sessions (older than 1 hour)
setInterval(() => {
  if (!fs.existsSync(DOWNLOADS_DIR)) return;
  const sessions = fs.readdirSync(DOWNLOADS_DIR);
  const now = Date.now();
  sessions.forEach(session => {
    const sessionDir = path.join(DOWNLOADS_DIR, session);
    try {
      const stat = fs.statSync(sessionDir);
      if (now - stat.ctimeMs > 60 * 60 * 1000) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch {}
  });
}, 15 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`\n🚀 MediaDown Server running at http://localhost:${PORT}`);
  console.log(`📦 yt-dlp status: ${checkYtDlp() ? '✅ مثبت' : '❌ غير مثبت — شغّل: pip install yt-dlp'}\n`);
});
