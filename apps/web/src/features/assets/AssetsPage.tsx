import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  FileText,
  LayoutGrid,
  List,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { Asset, AssetKind, AssetListQuery } from '@asset-manager/shared';
import { deleteAsset, getTags, listAssets } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UploadDialog } from '@/features/upload/UploadDialog';

const PAGE_SIZE = 24;
const VIEW_KEY = 'assets-view-mode';
const VALID_KINDS = new Set<string>(['image', 'video', 'pdf', 'other']);

type ViewMode = 'grid' | 'list';

const KIND_LABEL: Record<AssetKind, string> = {
  image: 'Image',
  video: 'Video',
  pdf: 'PDF',
  other: 'Other',
};

// ---------- hooks ----------

function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid',
  );
  return [
    mode,
    (next) => {
      localStorage.setItem(VIEW_KEY, next);
      setMode(next);
    },
  ];
}

// ---------- helpers ----------

function getThumbUrl(asset: Asset): string | null {
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  const { url, kind } = asset;
  const cut = url.indexOf('/upload/');
  if (cut === -1) return null;
  const base = url.slice(0, cut + 8);
  const rest = url.slice(cut + 8);
  if (kind === 'image') return `${base}w_400,h_400,c_fill/${rest}`;
  if (kind === 'video') {
    return `${base}w_400,h_400,c_fill,so_0/${rest.replace(/\.[^./]+$/, '')}.jpg`;
  }
  return null;
}

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

function fmtChipDate(isoDate: string): string {
  // Append T00:00:00 so the date is parsed in local time, not UTC midnight.
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------- shared sub-components ----------

function Thumb({ asset, className }: { asset: Asset; className?: string }) {
  const src = getThumbUrl(asset);
  if (src) {
    return (
      <img src={src} alt={asset.filename} className={cn('object-cover', className)} loading="lazy" />
    );
  }
  return (
    <div className={cn('flex items-center justify-center bg-muted', className)}>
      <FileText className="h-12 w-12 text-muted-foreground" />
    </div>
  );
}

function AssetMenu({ asset, onDelete }: { asset: Asset; onDelete: (a: Asset) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Asset actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => { window.location.href = `/api/assets/${asset.id}/download`; }}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(asset)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- grid card ----------

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete: (a: Asset) => void }) {
  return (
    <Card className="group overflow-hidden">
      <Link to={`/assets/${asset.id}`} className="block">
        <div className="aspect-square overflow-hidden">
          <Thumb
            asset={asset}
            className="h-full w-full transition-transform duration-200 group-hover:scale-105"
          />
        </div>
      </Link>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-1">
          <Link to={`/assets/${asset.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight" title={asset.filename}>
              {asset.filename}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{fmtBytes(asset.sizeBytes)}</p>
          </Link>
          <AssetMenu asset={asset} onDelete={onDelete} />
        </div>
        <Badge variant="secondary" className="mt-2 h-5 text-xs">
          {KIND_LABEL[asset.kind]}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ---------- list row ----------

function AssetRow({ asset, onDelete }: { asset: Asset; onDelete: (a: Asset) => void }) {
  return (
    <tr className="border-b transition-colors last:border-0 hover:bg-muted/30">
      <td className="px-4 py-2.5">
        <Link to={`/assets/${asset.id}`} className="font-medium hover:underline">
          <span className="block max-w-xs truncate" title={asset.filename}>
            {asset.filename}
          </span>
        </Link>
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="secondary" className="h-5 text-xs">
          {KIND_LABEL[asset.kind]}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">
        {fmtBytes(asset.sizeBytes)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">
        {fmtDate(asset.uploadedAt)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex max-w-[180px] flex-wrap gap-1">
          {asset.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="h-4 px-1 text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <AssetMenu asset={asset} onDelete={onDelete} />
      </td>
    </tr>
  );
}

// ---------- skeletons ----------

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-1 h-5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/50 px-4 py-2.5">
        <Skeleton className="h-4 w-64" />
      </div>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-0">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------- delete dialog ----------

function DeleteDialog({
  asset,
  isDeleting,
  onClose,
  onConfirm,
}: {
  asset: Asset | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete asset?</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{asset?.filename}</strong> will be permanently
            deleted from Cloudinary and cannot be recovered.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isDeleting} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- pagination ----------

function Pagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">
        {start}–{end} of {total} assets
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>
        <span className="min-w-[4rem] text-center text-sm tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
}

// ---------- tags combobox ----------

function TagsCombobox({
  allTags,
  selectedTags,
  onChange,
}: {
  allTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(tag: string) {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 min-w-[110px] justify-between gap-1"
        >
          <span>Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {allTags.map((tag) => (
                <CommandItem key={tag} value={tag} onSelect={() => toggle(tag)}>
                  <Check
                    className={cn('h-4 w-4', selectedTags.includes(tag) ? 'opacity-100' : 'opacity-0')}
                  />
                  {tag}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------- filter bar ----------

function FilterBar({
  kind,
  tags,
  from,
  to,
  allTags,
  hasFilters,
  onKindChange,
  onTagsChange,
  onFromChange,
  onToChange,
  onClear,
}: {
  kind: AssetKind | undefined;
  tags: string[];
  from: string | undefined;
  to: string | undefined;
  allTags: string[];
  hasFilters: boolean;
  onKindChange: (k: AssetKind | undefined) => void;
  onTagsChange: (tags: string[]) => void;
  onFromChange: (from: string | undefined) => void;
  onToChange: (to: string | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={kind ?? 'all'}
        onValueChange={(v) => onKindChange(v === 'all' ? undefined : (v as AssetKind))}
      >
        <SelectTrigger className="h-9 w-[120px]" aria-label="Filter by kind">
          <SelectValue placeholder="Kind" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="image">Images</SelectItem>
          <SelectItem value="video">Videos</SelectItem>
          <SelectItem value="pdf">PDFs</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      <TagsCombobox allTags={allTags} selectedTags={tags} onChange={onTagsChange} />

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From date"
          value={from ?? ''}
          max={to}
          onChange={(e) => onFromChange(e.target.value || undefined)}
          className="h-9 w-[150px] cursor-pointer"
        />
        <span className="text-sm text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label="To date"
          value={to ?? ''}
          min={from}
          onChange={(e) => onToChange(e.target.value || undefined)}
          className="h-9 w-[150px] cursor-pointer"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={onClear}>
          <X className="mr-1.5 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

// ---------- active filter chips ----------

function ActiveFilterChips({
  kind,
  tags,
  from,
  to,
  onRemoveKind,
  onRemoveTag,
  onRemoveFrom,
  onRemoveTo,
}: {
  kind: AssetKind | undefined;
  tags: string[];
  from: string | undefined;
  to: string | undefined;
  onRemoveKind: () => void;
  onRemoveTag: (tag: string) => void;
  onRemoveFrom: () => void;
  onRemoveTo: () => void;
}) {
  if (!kind && tags.length === 0 && !from && !to) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {kind && (
        <FilterChip label={KIND_LABEL[kind]} onRemove={onRemoveKind} />
      )}
      {tags.map((tag) => (
        <FilterChip key={tag} label={tag} onRemove={() => onRemoveTag(tag)} />
      ))}
      {from && (
        <FilterChip label={`From: ${fmtChipDate(from)}`} onRemove={onRemoveFrom} />
      )}
      {to && (
        <FilterChip label={`To: ${fmtChipDate(to)}`} onRemove={onRemoveTo} />
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

// ---------- page ----------

export function AssetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useViewMode();
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  // --- parse URL params ---
  const rawQ = searchParams.get('q');
  const rawPage = searchParams.get('page');
  const rawKind = searchParams.get('kind');
  const rawTags = searchParams.get('tags');
  const rawFrom = searchParams.get('from');
  const rawTo = searchParams.get('to');

  const page = Math.max(1, parseInt(rawPage ?? '1', 10));
  const kind = rawKind && VALID_KINDS.has(rawKind) ? (rawKind as AssetKind) : undefined;
  const tags = rawTags ? rawTags.split(',').filter(Boolean) : [];
  const from = rawFrom ?? undefined;
  const to = rawTo ?? undefined;

  const hasFilters = !!(kind || tags.length || from || to);

  // --- queries ---
  const query: AssetListQuery = {
    page,
    pageSize: PAGE_SIZE,
    ...(rawQ ? { q: rawQ } : {}),
    ...(kind ? { kind } : {}),
    ...(tags.length ? { tags } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assets', query],
    queryFn: () => listAssets(query),
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 60_000,
  });

  // --- URL mutation helpers ---
  function setFilter(key: string, value: string | null | undefined) {
    setSearchParams(
      (prev) => {
        if (value) prev.set(key, value);
        else prev.delete(key);
        prev.delete('page');
        return prev;
      },
      { replace: true },
    );
  }

  const setPage = (next: number) => {
    setSearchParams(
      (prev) => {
        if (next === 1) prev.delete('page');
        else prev.set('page', String(next));
        return prev;
      },
      { replace: false },
    );
  };

  const clearFilters = () => {
    setSearchParams(
      (prev) => {
        prev.delete('kind');
        prev.delete('tags');
        prev.delete('from');
        prev.delete('to');
        prev.delete('page');
        return prev;
      },
      { replace: true },
    );
  };

  // --- delete ---
  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteAsset(pendingDelete.id);
      toast.success(`"${pendingDelete.filename}" deleted`);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------- content ----------

  let content: React.ReactNode;

  if (isLoading) {
    content = viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />;
  } else if (error) {
    content = (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-muted-foreground">Something went wrong while loading assets.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  } else if (!data || data.items.length === 0) {
    const hasSearch = rawQ || hasFilters;
    content = (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="rounded-full bg-muted p-6">
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium">{hasSearch ? 'No results found' : 'No assets yet'}</p>
          <p className="text-sm text-muted-foreground">
            {hasSearch
              ? 'Try adjusting your search or filters.'
              : 'Upload your first asset to get started.'}
          </p>
        </div>
        {!hasSearch && <UploadDialog />}
      </div>
    );
  } else if (viewMode === 'grid') {
    content = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {data.items.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onDelete={setPendingDelete} />
        ))}
      </div>
    );
  } else {
    content = (
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-[600px] w-full text-sm" aria-label="Assets list">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">File</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Kind</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Size</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Uploaded</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tags</th>
              <th scope="col" className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((asset) => (
              <AssetRow key={asset.id} asset={asset} onDelete={setPendingDelete} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ---------- render ----------

  return (
    <div className="space-y-3">
      <FilterBar
        kind={kind}
        tags={tags}
        from={from}
        to={to}
        allTags={allTags}
        hasFilters={hasFilters}
        onKindChange={(k) => setFilter('kind', k)}
        onTagsChange={(t) => setFilter('tags', t.length ? t.join(',') : null)}
        onFromChange={(f) => setFilter('from', f)}
        onToChange={(t) => setFilter('to', t)}
        onClear={clearFilters}
      />

      <ActiveFilterChips
        kind={kind}
        tags={tags}
        from={from}
        to={to}
        onRemoveKind={() => setFilter('kind', null)}
        onRemoveTag={(tag) => {
          const next = tags.filter((t) => t !== tag);
          setFilter('tags', next.length ? next.join(',') : null);
        }}
        onRemoveFrom={() => setFilter('from', null)}
        onRemoveTo={() => setFilter('to', null)}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data != null ? `${data.total} asset${data.total !== 1 ? 's' : ''}` : null}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {content}

      {data && data.items.length > 0 && (
        <Pagination page={page} total={data.total} onPageChange={setPage} />
      )}

      <DeleteDialog
        asset={pendingDelete}
        isDeleting={isDeleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />
    </div>
  );
}
