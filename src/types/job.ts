// src/types/job.ts
export interface JobPayload {
    jobId: string;
    scriptId: string;
    scriptContent: string;
    parameters: Record<string, any>; // Or a more specific type if known
  }
  