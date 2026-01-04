export interface FileData {
  id: string;
  filename: string;
  thumbnail_url: string;
  exif: Record<string, any>;
}

export interface ProcessResponse {
  success: boolean;
  exif: Record<string, any>;
  error?: string;
}
