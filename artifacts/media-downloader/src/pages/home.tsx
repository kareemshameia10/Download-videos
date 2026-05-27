import { useState, useEffect } from "react";
import { 
  useGetMediaInfo, 
  useStartDownload, 
  useGetDownloadStatus,
  getGetDownloadStatusQueryKey
} from "@workspace/api-client-react";
import { Download, Link as LinkIcon, Loader2, AlertCircle, CheckCircle2, PlaySquare, Music, Video, HardDrive, RefreshCw, FileArchive } from "lucide-react";
import { formatBytes, getPlatformInfo, getFormatLabel, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MediaInfo, MediaFormat } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Home() {
  const [url, setUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const getMediaInfo = useGetMediaInfo();
  const startDownload = useStartDownload();
  
  const { data: jobStatus, isError: isJobError } = useGetDownloadStatus(activeJobId ?? "", {
    query: {
      enabled: !!activeJobId && activeJobId !== "",
      queryKey: getGetDownloadStatusQueryKey(activeJobId ?? ""),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return (status === 'done' || status === 'error') ? false : 1500;
      }
    }
  });

  const handleFetchInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    // Reset state for new fetch
    setActiveJobId(null);
    getMediaInfo.mutate({ data: { url: url.trim() } });
  };

  const handleStartDownload = (formatId: string) => {
    if (!getMediaInfo.data || !url.trim()) return;
    
    startDownload.mutate({
      data: {
        url: url.trim(),
        formatId,
        title: getMediaInfo.data.title
      }
    }, {
      onSuccess: (job) => {
        setActiveJobId(job.jobId);
      }
    });
  };

  const reset = () => {
    setUrl("");
    getMediaInfo.reset();
    startDownload.reset();
    setActiveJobId(null);
  };

  const isDownloading = activeJobId && jobStatus && !['done', 'error'].includes(jobStatus.status);
  const isDone = jobStatus?.status === 'done';
  const hasJobError = jobStatus?.status === 'error' || isJobError;
  const showFormats = getMediaInfo.data && !activeJobId;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-8 selection:bg-primary/30">
      
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMSIvPjwvc3ZnPg==')] opacity-30"></div>
      </div>

      <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-2xl shadow-primary/10 mb-2">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic text-zinc-100">
            Media<span className="text-primary drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">Grab</span>
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-md mx-auto">
            Zero friction. Maximum speed. Paste a link and pull the media you need.
          </p>
          <a
            href="/get"
            data-testid="link-download-project"
            className="inline-flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-primary border border-zinc-800 hover:border-primary/40 px-3 py-1.5 rounded-full transition-all bg-zinc-900/50"
          >
            <FileArchive className="w-3.5 h-3.5" />
            تحميل المشروع كـ ZIP
          </a>
        </div>

        {/* Main Input Form */}
        <form onSubmit={handleFetchInfo} className="relative group">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-xl transition-opacity opacity-0 group-focus-within:opacity-100"></div>
          <div className="relative flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-zinc-500" />
              </div>
              <Input 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="h-16 pl-12 pr-4 bg-zinc-900/90 border-zinc-800 text-lg shadow-inner font-mono rounded-xl focus-visible:ring-primary focus-visible:border-primary transition-all placeholder:text-zinc-600"
                disabled={getMediaInfo.isPending || !!activeJobId}
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              disabled={!url.trim() || getMediaInfo.isPending || !!activeJobId}
              className="h-16 px-8 rounded-xl bg-primary text-black hover:bg-primary/90 font-bold tracking-wide uppercase shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all disabled:opacity-50"
            >
              {getMediaInfo.isPending ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Fetching</>
              ) : (
                <><Download className="mr-2 h-5 w-5" /> Grab</>
              )}
            </Button>
          </div>
        </form>

        {/* Error State - Info Fetch */}
        {getMediaInfo.isError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold uppercase tracking-wider text-sm">Failed to retrieve media</h3>
              <p className="text-sm opacity-80">{getMediaInfo.error?.error || "Invalid URL or platform not supported."}</p>
            </div>
          </div>
        )}

        {/* Result Area */}
        {(getMediaInfo.data || activeJobId) && (
          <Card className="bg-zinc-900/60 border-zinc-800/50 backdrop-blur-md overflow-hidden rounded-2xl animate-in fade-in zoom-in-95 duration-500">
            <CardContent className="p-0">
              
              {/* Media Header */}
              {getMediaInfo.data && (
                <div className="flex flex-col sm:flex-row p-6 gap-6 border-b border-zinc-800/50 bg-zinc-900/40">
                  <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800 shadow-inner">
                    {getMediaInfo.data.thumbnail ? (
                      <img src={getMediaInfo.data.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-mono font-medium text-zinc-300">
                      {getMediaInfo.data.duration ? `${Math.floor(getMediaInfo.data.duration / 60)}:${(getMediaInfo.data.duration % 60).toString().padStart(2, '0')}` : '??:??'}
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider", getPlatformInfo(url).color)}>
                        {getPlatformInfo(url).name}
                      </Badge>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-zinc-100 line-clamp-2 leading-tight">
                      {getMediaInfo.data.title}
                    </h2>
                  </div>
                </div>
              )}

              {/* Formats Selection */}
              {showFormats && (
                <div className="p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" /> Available Formats
                  </h3>
                  <ScrollArea className="h-[300px] pr-4 -mr-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                      {getMediaInfo.data?.formats.map((format, i) => {
                        const isAudioOnly = format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none');
                        
                        return (
                          <button
                            key={`${format.formatId}-${i}`}
                            onClick={() => handleStartDownload(format.formatId)}
                            disabled={startDownload.isPending}
                            className="group flex flex-col p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-left relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex justify-between items-start mb-2">
                              <span className="font-bold text-zinc-200 group-hover:text-primary transition-colors flex items-center gap-2">
                                {isAudioOnly ? <Music className="w-4 h-4 text-zinc-500" /> : <PlaySquare className="w-4 h-4 text-zinc-500" />}
                                {getFormatLabel(format)}
                              </span>
                              {format.filesize && (
                                <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded">
                                  {formatBytes(format.filesize)}
                                </span>
                              )}
                            </div>
                            <div className="relative text-xs text-zinc-600 font-mono flex items-center gap-2">
                              <span>EXT: {format.ext}</span>
                              <span className="opacity-50">•</span>
                              <span>ID: {format.formatId}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Active Download State */}
              {activeJobId && (
                <div className="p-8 flex flex-col items-center justify-center min-h-[250px] animate-in zoom-in-95 duration-300">
                  
                  {isDownloading && (
                    <div className="w-full max-w-md space-y-6 text-center">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
                        <div className="absolute inset-0 w-12 h-12 bg-primary/20 blur-xl rounded-full mx-auto"></div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-zinc-100 uppercase tracking-widest animate-pulse">
                          {jobStatus?.status === 'zipping' ? 'Packaging Files...' : 'Downloading...'}
                        </h3>
                        <p className="text-sm font-mono text-primary/80">
                          {jobStatus?.progress ? `${jobStatus.progress.toFixed(1)}%` : 'Starting job...'}
                        </p>
                      </div>

                      <Progress 
                        value={jobStatus?.progress || 0} 
                        className="h-2 bg-zinc-900 border border-zinc-800"
                        indicatorClassName="bg-primary shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all duration-1000 ease-out"
                      />
                    </div>
                  )}

                  {isDone && (
                    <div className="w-full max-w-md space-y-8 text-center animate-in fade-in slide-in-from-bottom-4">
                      <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto border border-primary/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                        <CheckCircle2 className="w-10 h-10 text-primary" />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-zinc-100">Ready for Download</h3>
                        <p className="text-zinc-500 text-sm">Your file has been processed successfully.</p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <a 
                          href={`/api/download/${activeJobId}/file`}
                          className="flex items-center justify-center w-full h-14 rounded-xl bg-primary text-black font-bold tracking-wider uppercase shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:scale-[1.02] transition-all"
                        >
                          <Download className="w-5 h-5 mr-2" /> Save to Device
                        </a>
                        <Button 
                          variant="outline" 
                          onClick={reset}
                          className="h-14 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" /> Download Another
                        </Button>
                      </div>
                    </div>
                  )}

                  {hasJobError && (
                    <div className="w-full max-w-md space-y-6 text-center animate-in fade-in zoom-in">
                      <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto border border-destructive/30">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-zinc-100">Download Failed</h3>
                        <p className="text-destructive/80 text-sm font-mono p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                          {jobStatus?.error || 'An unexpected error occurred during processing.'}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={reset}
                        className="w-full h-12 border-zinc-800"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}

                </div>
              )}

            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}