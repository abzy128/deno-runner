// src/types/worker.ts

// Message from Main Thread to Worker
export type WorkerCommand =
  | { type: "execute"; scriptContent: string; parameters: Record<string, any> }
  | { type: "integrationResponse"; callId: string; success: true; result: any }
  | {
    type: "integrationResponse";
    callId: string;
    success: false;
    error: string;
  };

// Message from Worker to Main Thread
export type WorkerMessage =
  | { type: "ready" }
  | {
    type: "completed";
    finalParameters: Record<string, any>;
  }
  | { type: "error"; error: string }
  | {
    type: "integrationRequest";
    callId: string;
    name: string;
    args: any[];
  };
