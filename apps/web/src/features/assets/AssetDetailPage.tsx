import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileText,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Asset } from '@asset-manager/shared';
import { getAsset, deleteAsset, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---------- helpers ----------

function fmtBytes(n: number): string {
  if (n < 1_024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1_024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const KIND_LABEL: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  pdf: 'PDF',
  other: 'Other',
};

// ---------- preview ----------

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.kind === 'image') {
    return (
      <div className="flex items-center justify-center rounded-lg bg-muted/40 p-4">
        <img
          src={asset.url}
          alt={asset.filename}
          className="max-h-[70vh] w-auto max-w-full rounded object-contain shadow"
        />
      </div>
    );
  }

  if (asset.kind === 'video') {
    return (
      <div className="overflow-hidden rounded-lg bg-black">
        {/* key forces remount when the asset changes */}
        <video controls className="max-h-[70vh] w-full" key={asset.url}>
          <source src={asset.url} type={asset.mimeType} />
          Your browser does not support the video element.
        </video>
      </div>
    );
  }

  if (asset.kind === 'pdf') {
    return (
      <div className="overflow-hidden rounded-lg border" style={{ height: '70vh' }}>
        <iframe src={asset.url} title={asset.filename} className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-64 items-center justify-center rounded-lg bg-muted">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <FileText className="h-16 w-16" />
        <p className="text-sm">No preview available</p>
      </div>
    </div>
  );
}

// ---------- metadata ----------

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

// ---------- skeleton ----------

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-20" />
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <Skeleton className="h-[60vh] w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-16" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- page ----------

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    data: asset,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id!),
    enabled: !!id,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return failureCount < 2;
    },
  });

  async function handleDelete() {
    if (!asset) return;
    setIsDeleting(true);
    try {
      await deleteAsset(asset.id);
      toast.success(`"${asset.filename}" deleted`);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  async function handleCopyUrl() {
    if (!asset) return;
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy URL');
    }
  }

  // --- loading ---
  if (isLoading) return <DetailSkeleton />;

  // --- error / not-found ---
  if (error) {
    const is404 = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg font-medium">{is404 ? 'Asset not found' : 'Something went wrong'}</p>
        <p className="text-sm text-muted-foreground">
          {is404
            ? 'This asset may have been deleted or the link is invalid.'
            : 'An error occurred while loading this asset.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to assets
          </Button>
          {!is404 && (
            <Button variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!asset) return null;

  return (
    <div className="space-y-6">
      {/* Back button — navigate(-1) restores the previous URL including search params */}
      <Button
        variant="ghost"
        className="-ml-2 h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Preview */}
        <AssetPreview asset={asset} />

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Title + kind badge */}
          <div>
            <h1 className="break-all text-lg font-semibold leading-tight">{asset.filename}</h1>
            <Badge variant="secondary" className="mt-1.5">
              {KIND_LABEL[asset.kind]}
            </Badge>
          </div>

          {/* Metadata rows */}
          <div className="divide-y rounded-lg border px-3">
            <MetaRow label="Size" value={fmtBytes(asset.sizeBytes)} />
            {asset.width != null && asset.height != null && (
              <MetaRow label="Dimensions" value={`${asset.width} × ${asset.height}`} />
            )}
            {asset.durationSec != null && (
              <MetaRow label="Duration" value={fmtDuration(asset.durationSec)} />
            )}
            <MetaRow label="Uploaded" value={fmtDate(asset.uploadedAt)} />
            {asset.uploadedBy && <MetaRow label="By" value={asset.uploadedBy} />}
          </div>

          {/* Tags */}
          {asset.tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {asset.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                window.location.href = `/api/assets/${asset.id}/download`;
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void handleCopyUrl()}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy URL'}
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setShowDeleteDialog(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete asset?</DialogTitle>
            <DialogDescription>
              <strong className="text-foreground">{asset.filename}</strong> will be permanently
              deleted from Cloudinary and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
