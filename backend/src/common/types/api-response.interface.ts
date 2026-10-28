export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    statusCode: number;
    message: string | string[];
    error?: string;
  };
  timestamp: string;
  correlationId: string;
}
