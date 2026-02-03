export interface FileData {
  id: string;
  filename: string;
  thumbnail_url: string;
  exif: Record<string, unknown>;
  aigc?: boolean;
  aigc_detail?: {
    is_aigc: boolean;
    matched: string | null;
    source: string | null;
  };
  width?: number | null;
  height?: number | null;
  format?: string | null;
}

export interface ProcessResponse {
  success: boolean;
  exif: Record<string, unknown>;
  error?: string;
  new_filename?: string | null;
  aigc?: boolean;
  aigc_detail?: {
    is_aigc: boolean;
    matched: string | null;
    source: string | null;
  };
  width?: number | null;
  height?: number | null;
  format?: string | null;
}
