const express = require('express');
const { exec, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Detect yt-dlp binary once at startup
let YT_DLP_BIN = null;
function detectBin() {
  const candidates = ['python3 -m yt_dlp', 'python -m yt_dlp', 'yt-dlp'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe', timeout: 10000 });
      console.log(`✅ yt-dlp found: ${cmd}`);
      return cmd;
    } catch {}
  }
  return null;
}

YT_DLP_BIN = detectBin();
console.log(`yt-dlp bin: ${YT_DLP_BIN || 'NOT FOUND'}`);

// Get available formats
app.post('/api/formats', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL مطلوب' });

  if (!YT_DLP_BIN) {
    YT_DLP_BIN = detectBin();
    if (!YT_DLP_BIN) return res.status(500).json({ error: 'yt-dlp غير مثبت على السيرفر' });
  }

  let stdoutData = '';
  let stderrData = '';

  // Use spawn to separate stdout and stderr properly
  const args = ['-J', '--no-playlist', url];
  let proc;

  if (YT_DLP_BIN.includes('python')) {
    const parts = YT_DLP_BIN.split(' ');
    proc = spawn(parts[0], [...parts.slice(1), ...args]);
  } else {
    proc = spawn('yt-dlp', args);
  }

  const timer = setTimeout(() => {
    proc.kill();
    return res.status(400).json({ error: 'انتهى الوقت، الرابط بطيء أو غير صحيح' });
  }, 30000);

  proc.stdout.on('data', d => { stdoutData += d.toString(); });
  proc.stderr.on('data', d => { stderrData += d.toString(); });

  proc.on('close', (code) => {
    clearTimeout(timer);
    if (res.headersSent) return;

    if (code !== 0) {
      console.error('yt-dlp error:', stderrData);
      return res.status(400).json({ error: stderrData || 'تعذّر جلب معلومات الرابط' });
    }

    try {
      const info = JSON.parse(stdoutData);
      const formats = [];

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
      console.error('JSON parse error:', parseErr.message);
      console.error('stdout was:', stdoutData.slice(0, 500));
      res.status(400).json({ error: 'تعذّر قراءة بيانات الفيديو: ' + parseErr.message });
    }
  });

  proc.on('error', (err) => {
    clearTimeout(timer);
    if (!res.headersSent) {
      res.status(500).json({ error: 'فشل تشغيل yt-dlp: ' + err.message });
    }
  });
});

// Download media
app.post('/api/download', (req, res) => {
  const { url, format_id, ext, audioOnly } = req.body;
  if (!url || !format_id) return res.status(400).json({ error: 'بيانات ناقصة' });

  if (!YT_DLP_BIN) {
    YT_DLP_BIN = detectBin();
    if (!YT_DLP_BIN) return res.status(500).json({ error: 'yt-dlp غير مثبت' });
  }

  const sessionId = uuidv4();
  const sessionDir = path.join(DOWNLOADS_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

  let args;
  if (audioOnly || ext === 'mp3') {
    args = ['-f', format_id, '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0', '-o', outputTemplate, url];
  } else {
    args = ['-f', format_id, '--merge-output-format', 'mp4', '-o', outputTemplate, url];
  }

  res.json({ sessionId, status: 'started' });

  let proc;
  if (YT_DLP_BIN.includes('python')) {
    const parts = YT_DLP_BIN.split(' ');
    proc = spawn(parts[0], [...parts.slice(1), ...args]);
  } else {
    proc = spawn('yt-dlp', args);
  }

  let stderrData = '';
  proc.stderr.on('data', d => { stderrData += d.toString(); });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`[${sessionId}] Error:`, stderrData);
      fs.writeFileSync(path.join(sessionDir, 'error.txt'), stderrData || 'خطأ غير معروف');
    } else {
      console.log(`[${sessionId}] Done!`);
      fs.writeFileSync(path.join(sessionDir, 'done.txt'), 'success');
    }
  });

  proc.on('error', (err) => {
    fs.writeFileSync(path.join(sessionDir, 'error.txt'), err.message);
  });
});

// Check download status
app.get('/api/status/:sessionId', (req, res) => {
  const sessionDir = path.join(DOWNLOADS_DIR, req.params.sessionId);
  if (!fs.existsSync(sessionDir)) return res.json({ status: 'not_found' });
  if (fs.existsSync(path.join(sessionDir, 'error.txt'))) {
    const error = fs.readFileSync(path.join(sessionDir, 'error.txt'), 'utf8');
    return res.json({ status: 'error', error });
  }
  if (fs.existsSync(path.join(sessionDir, 'done.txt'))) return res.json({ status: 'done' });
  return res.json({ status: 'processing' });
});

// Create ZIP and download
app.get('/api/zip/:sessionId', (req, res) => {
  const sessionDir = path.join(DOWNLOADS_DIR, req.params.sessionId);
  if (!fs.existsSync(sessionDir)) return res.status(404).json({ error: 'الجلسة غير موجودة' });

  const files = fs.readdirSync(sessionDir).filter(f => !f.endsWith('.txt'));
  if (files.length === 0) return res.status(404).json({ error: 'لا توجد ملفات للتحميل' });

  const zipName = `mediadown_${req.params.sessionId.slice(0, 8)}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);
  files.forEach(file => archive.file(path.join(sessionDir, file), { name: file }));
  archive.finalize();

  setTimeout(() => fs.rmSync(sessionDir, { recursive: true, force: true }), 10 * 60 * 1000);
});

// Cleanup old sessions
setInterval(() => {
  if (!fs.existsSync(DOWNLOADS_DIR)) return;
  const now = Date.now();
  fs.readdirSync(DOWNLOADS_DIR).forEach(session => {
    const sessionDir = path.join(DOWNLOADS_DIR, session);
    try {
      const stat = fs.statSync(sessionDir);
      if (now - stat.ctimeMs > 60 * 60 * 1000) fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
  });
}, 15 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`\n🚀 MediaDown Server running at http://localhost:${PORT}`);
  console.log(`📦 yt-dlp bin: ${YT_DLP_BIN || '❌ NOT FOUND'}\n`);
});
