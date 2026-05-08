import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadAsset, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  'application/pdf': ['.pdf'],
};

export function UploadDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [rejectionMsg, setRejectionMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setFiles([]);
    setTags([]);
    setTagInput('');
    setProgress(0);
    setCurrentIndex(0);
    setRejectionMsg('');
  };

  const commitTags = useCallback((raw: string) => {
    const incoming = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!incoming.length) return;
    setTags((prev) => Array.from(new Set([...prev, ...incoming])));
    setTagInput('');
  }, []);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setFiles((prev) => [...prev, ...accepted]);
    if (rejected.length) {
      const names = rejected.map((r) => r.file.name).join(', ');
      setRejectionMsg(
        `${names} — only JPEG, PNG, WebP, GIF, MP4, MOV, WebM, and PDF are accepted.`,
      );
    } else {
      setRejectionMsg('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_TYPES,
    multiple: true,
    disabled: uploading,
    onDrop,
  });

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTags(tagInput);
    } else if (e.key === 'Backspace' && !tagInput) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (uploading) return;
    if (!next) reset();
    setOpen(next);
  };

  const handleUpload = async () => {
    if (!files.length || uploading) return;
    setUploading(true);

    let failed = false;
    let aborted = false;

    for (const [i, file] of files.entries()) {
      setCurrentIndex(i);
      setProgress(0);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        await uploadAsset(file, tags, (pct) => setProgress(pct), ac.signal);
        toast.success(`Uploaded ${file.name}`);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'UPLOAD_ABORTED') {
          aborted = true;
          break;
        }
        toast.error(err instanceof Error ? err.message : 'Upload failed');
        failed = true;
        break;
      }
    }

    abortRef.current = null;
    setUploading(false);
    setProgress(0);

    if (!failed && !aborted) {
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      reset();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload assets</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          aria-label="File upload area — drag and drop or click to browse"
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/30 hover:border-muted-foreground/60',
            uploading && 'pointer-events-none opacity-50',
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-sm font-medium text-primary">Drop files here…</p>
          ) : (
            <>
              <p className="text-sm font-medium">Drag &amp; drop files here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                or{' '}
                <span className="text-primary underline underline-offset-2">browse</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                JPEG · PNG · WebP · GIF · MP4 · MOV · WebM · PDF
              </p>
            </>
          )}
        </div>

        {rejectionMsg && <p className="text-sm text-destructive">{rejectionMsg}</p>}

        {/* Queued files */}
        {files.length > 0 && (
          <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5"
              >
                <span className="flex-1 truncate">{file.name}</span>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove ${file.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Per-file progress */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate">
                {currentIndex + 1} of {files.length} — {files[currentIndex]?.name}
              </span>
              <span className="shrink-0 pl-2">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Tag input */}
        <div className="space-y-1.5">
          <label htmlFor="upload-tag-input" className="text-sm font-medium">Tags</label>
          <div className="flex min-h-10 flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  aria-label={`Remove tag ${tag}`}
                  className="rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              id="upload-tag-input"
              className="min-w-16 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={tags.length === 0 ? 'campaign, 2024…' : ''}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKey}
              onBlur={() => {
                if (tagInput.trim()) commitTags(tagInput);
              }}
              disabled={uploading}
            />
          </div>
          <p className="text-xs text-muted-foreground">Comma or Enter to add</p>
        </div>

        <DialogFooter>
          {uploading ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
          <Button
            onClick={() => {
              void handleUpload();
            }}
            disabled={uploading || files.length === 0}
          >
            {uploading ? 'Uploading…' : files.length > 1 ? `Upload ${files.length} files` : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
