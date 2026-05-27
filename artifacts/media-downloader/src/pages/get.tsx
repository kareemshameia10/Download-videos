import { Download, FileArchive, Github, Server, Code2, ArrowRight } from "lucide-react";

export default function GetPage() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-8 selection:bg-primary/30">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-2xl space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-2xl shadow-primary/10 mb-2">
            <FileArchive className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic text-zinc-100">
            Media<span className="text-primary drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">Grab</span>
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-md mx-auto">
            تحميل ملف المشروع الكامل — الكود المصدري + جميع الملفات.
          </p>
        </div>

        {/* Download Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md overflow-hidden">

          {/* File info */}
          <div className="p-6 border-b border-zinc-800/60 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <FileArchive className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-zinc-100 text-lg">mediagrab-core.zip</p>
              <p className="text-xs font-mono text-zinc-500">الكود الأساسي فقط · ~76 KB</p>
            </div>
            <span className="text-xs uppercase tracking-widest font-bold text-primary border border-primary/30 px-3 py-1 rounded-full bg-primary/10">ZIP</span>
          </div>

          {/* Download Button */}
          <div className="p-6">
            <a
              href="/api/project/zip"
              data-testid="button-download-zip"
              className="flex items-center justify-center w-full h-16 rounded-xl bg-primary text-black font-bold tracking-wider uppercase text-lg shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:scale-[1.02] transition-all gap-3"
            >
              <Download className="w-6 h-6" />
              تحميل الملف
            </a>
          </div>
        </div>

        {/* What's inside */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">ما يحتويه الملف</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Code2, label: "كود المصدر", desc: "React + Express + TypeScript" },
              { icon: Server, label: "خادم API", desc: "yt-dlp + ZIP generation" },
              { icon: Github, label: "جاهز للرفع", desc: "GitHub + Render" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-zinc-200 text-sm">{label}</p>
                  <p className="text-zinc-500 text-xs font-mono">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            data-testid="link-back-home"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-primary transition-colors font-mono"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            العودة إلى المحمّل
          </a>
        </div>

      </div>
    </div>
  );
}
