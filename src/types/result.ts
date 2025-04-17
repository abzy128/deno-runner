// src/types/result.ts
export interface ResultPayload {
    jobId: string;
    scriptId: string;
    status: "success" | "failure";
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
    finalParameters: Record<string, any>;
    errorDetails?: string | null;
  }
  