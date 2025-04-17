// src/jobs/execution/executor.ts
import { config } from "../../config.ts";
import { availableIntegrations } from "../../integrations/mod.ts";
import type {
  JobPayload,
  WorkerCommand,
  WorkerMessage,
} from "../../types/index.ts";

export interface ExecutionResult {
  success: boolean;
  finalParameters: Record<string, any>;
  error?: string;
}

export function executeScriptInWorker(
  payload: Pick<JobPayload, "scriptContent" | "parameters">
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let timeoutId: number | undefined;

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (worker) {
        worker.terminate();
        worker = null;
        console.log("[Executor] Worker terminated.");
      }
    };

    try {
      // Resolve the worker script relative to this file's location
      const workerScriptPath = new URL("./worker_script.ts", import.meta.url)
        .href;
      worker = new Worker(workerScriptPath, { type: "module" });
      console.log("[Executor] Worker created.");

      // Set execution timeout
      timeoutId = setTimeout(() => {
        console.error("[Executor] Script execution timed out.");
        cleanup();
        resolve({
          success: false,
          finalParameters: payload.parameters, // Return initial params on timeout
          error: "Execution timed out",
        });
      }, config.runner.executionTimeoutMs);

      worker.onerror = (event) => {
        event.preventDefault(); // Prevent Deno from logging the error twice
        console.error("[Executor] Worker error event:", event.message);
        cleanup();
        resolve({
          success: false,
          finalParameters: payload.parameters, // Return initial params on error
          error: `Worker error: ${event.message}`,
        });
      };

      worker.onmessage = async (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        console.log("[Executor] Received message from worker:", message.type);

        switch (message.type) {
          case "ready":
            // Worker is ready, send the script to execute
            worker?.postMessage({
              type: "execute",
              scriptContent: payload.scriptContent,
              parameters: payload.parameters,
            } satisfies WorkerCommand);
            break;

          case "completed":
            cleanup();
            resolve({
              success: true,
              finalParameters: message.finalParameters,
            });
            break;

          case "error":
            cleanup();
            resolve({
              success: false,
              finalParameters: payload.parameters, // Return initial params on script error
              error: message.error,
            });
            break;

          case "integrationRequest": {
            // Worker is requesting an integration call
            const { callId, name, args } = message;
            const integrationFn = availableIntegrations[name];

            if (typeof integrationFn === "function") {
              try {
                const result = await integrationFn(...args);
                worker?.postMessage({
                  type: "integrationResponse",
                  callId,
                  success: true,
                  result,
                } satisfies WorkerCommand);
              } catch (error) {
                console.error(
                  `[Executor] Integration call '${name}' failed:`,
                  error
                );
                worker?.postMessage({
                  type: "integrationResponse",
                  callId,
                  success: false,
                  error:
                    error instanceof Error ? error.message : String(error),
                } satisfies WorkerCommand);
              }
            } else {
              // Function not found in available integrations
              console.error(
                `[Executor] Worker requested unknown integration: ${name}`
              );
              worker?.postMessage({
                type: "integrationResponse",
                callId,
                success: false,
                error: `Integration function '${name}' not available.`,
              } satisfies WorkerCommand);
            }
            break;
          }
        }
      };
    } catch (error) {
      console.error("[Executor] Failed to create or manage worker:", error);
      cleanup();
      resolve({
        success: false,
        finalParameters: payload.parameters,
        error: `Worker setup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });
}
