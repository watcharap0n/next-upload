export interface WebSocketStatus {
  upload_id?: string;
  progress_percent?: number;
  upload_status?: string; // Changed from union type to string to match UploadStatus
  processing_status?: string;
  current_part?: number;
  total_parts?: number;
  filename?: string;
  error_message?: string;
  error_code?: string;
  server_message?: string;
  upload_speed?: number;
  eta_seconds?: number;
  bytes_uploaded?: number;
  total_bytes?: number;
  timestamp?: string; // Added to match UploadStatus
}

export interface Notification {
  id: string;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

export type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
