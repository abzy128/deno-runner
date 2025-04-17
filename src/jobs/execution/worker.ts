// src/jobs/execution/worker_script.ts
/// <reference lib="deno.worker" />
import type { WorkerCommand, WorkerMessage } from "../../types/index.ts";

console.log("[Worker] Script started.");

let currentParameters: Record<string, any> = {};
let integrationCallId = 0;
const pendingIntegrationCalls = new Map<
  string,
  { resolve: (value: any) => void; reject: (reason?: any) => void }
>();

// --- Integration Proxy ---
// This creates functions (like getData, createRecord) inside the worker
// that send messages *back* to the main thread to perform the actual call.
const integrations: Record<string, (...args: any[]) => Promise<any>> = {};

function createIntegrationProxy(name: string) {
  return async (...args: any[]): Promise<any> => {
    const callId = `call-${integrationCallId++}`;
    const promise = new Promise((resolve, reject) => {
      pendingIntegrationCalls.set(callId, { resolve, reject });
    });

    // Send request to main thread
    self.postMessage({
      type: "integrationRequest",
      callId: callId,
      name: name,
      args: args,
    } satisfies WorkerMessage);

    return promise;
  };
}

// --- Message Handling ---
self.onmessage = async (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;
  console.log("[Worker] Received command:", command.type);

  switch (command.type) {
    case "execute": {
      currentParameters = command.parameters; // Store parameters locally
      const scriptContent = command.scriptContent;

      // Dynamically create proxies for the integrations the main thread supports
      // (We assume the main thread told us which ones are available, implicitly via the proxy mechanism)
      // A more robust way would be for the main thread to send a list of available integration names.
      // For now, we rely on the script calling functions that the main thread knows how to handle.
      integrations["getData"] = createIntegrationProxy("getData");
      integrations["createRecord"] = createIntegrationProxy("createRecord");
      // Add proxies for other integrations here if needed

      try {
        // IMPORTANT: Execute the user script.
        // Using `new Function` here is still risky if the scriptContent is malicious.
        // A safer alternative might involve parsing/analyzing the script first,
        // or using a more secure sandbox if available.
        // For this example, we proceed with Function, assuming some level of trust
        // or prior validation of scriptContent.
        const userScript = new Function(
          "parameters",
          "integrations", // Pass the proxy object
          `return (async () => {
            // Make integrations available globally *within this function's scope*
            const { getData, createRecord } = integrations;
             ${scriptContent}
           })();`
        );

        // Run the script
        await userScript(currentParameters, integrations);

        // If successful, send back the final parameters
        self.postMessage({
          type: "completed",
          finalParameters: currentParameters, // Send potentially modified params
        } satisfies WorkerMessage);
      } catch (error) {
        console.error("[Worker] Script execution error:", error);
        self.postMessage({
          type: "error",
          error: error instanceof Error ? error.stack : String(error),
        } satisfies WorkerMessage);
      }
      break;
    }

    case "integrationResponse": {
      const call = pendingIntegrationCalls.get(command.callId);
      if (call) {
        if (command.success) {
          call.resolve(command.result);
        } else {
          call.reject(new Error(command.error));
        }
        pendingIntegrationCalls.delete(command.callId);
      } else {
        console.warn(
          `[Worker] Received response for unknown callId: ${command.callId}`
        );
      }
      break;
    }
  }
};

// Signal readiness to the main thread
self.postMessage({ type: "ready" } satisfies WorkerMessage);
console.log("[Worker] Ready.");
