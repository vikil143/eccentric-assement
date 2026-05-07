export type AssetKind = "image" | "video" | "pdf" | "other";

export interface Asset {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: AssetKind;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  uploadedAt: string;
  uploadedBy?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  cloudinaryPublicId: string;
}

export interface AssetListQuery {
  q?: string;
  kind?: AssetKind;
  tags?: string[];
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "size_desc";
}

export interface AssetListResponse {
  items: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}
