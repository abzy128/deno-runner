// src/jobs/processor.ts
import type { ConsumeResult } from "@nashaddams/amqp";
import { publishResult } from "../amqp/client.ts"; // Assuming this exists
import type { JobPayload, ResultPayload } from "../types/index.ts";
import { executeScriptInWorker } from "./execution/executor.ts";

export async function processJob(
  message: ConsumeResult
): Promise<void> {
  const messageString = new TextDecoder().decode(message.data);
  console.log(`[Processor] Received job message.`);
  let jobPayload: JobPayload;

  try {
    jobPayload = JSON.parse(messageString);
    // Basic validation
    if (
      !jobPayload || typeof jobPayload.jobId !== "string" ||
      typeof jobPayload.scriptContent !== "string" ||
      typeof jobPayload.parameters !== "object"
    ) {
      throw new Error("Invalid job payload structure");
    }
  } catch (e) {
    console.error("[Processor] Failed to parse job message:", e);
    // Acknowledge message to prevent requeue loop for bad format
    await message.ack();
    // Optionally send to a dead-letter queue here
    return;
  }

  const { jobId, scriptId, scriptContent, parameters: initialParams } =
    jobPayload;
  const startTime = new Date();
  let resultPayload: Omit<ResultPayload, "endTime">; // Build incrementally

  console.log(`[Processor] Starting job ${jobId} (Script ID: ${scriptId})`);

  try {
    const executionResult = await executeScriptInWorker({
      scriptContent,
      parameters: initialParams,
    });

    if (executionResult.success) {
      console.log(`[Processor] Job ${jobId} executed successfully.`);
      resultPayload = {
        jobId,
        scriptId,
        status: "success",
        startTime: startTime.toISOString(),
        finalParameters: executionResult.finalParameters,
        errorDetails: null,
      };
    } else {
      console.error(`[Processor] Job ${jobId} failed during execution.`);
      resultPayload = {
        jobId,
        scriptId,
        status: "failure",
        startTime: startTime.toISOString(),
        finalParameters: executionResult.finalParameters, // Return params even on failure
        errorDetails: executionResult.error ?? "Unknown execution error",
      };
    }
  } catch (error) {
    // Catch errors in the executor setup itself (less likely)
    console.error(`[Processor] Critical error processing job ${jobId}:`, error);
    resultPayload = {
      jobId,
      scriptId,
      status: "failure",
      startTime: startTime.toISOString(),
      finalParameters: initialParams, // Return initial params on critical failure
      errorDetails: `Processor error: ${
        error instanceof Error ? error.stack : String(error)
      }`,
    };
  }

  const endTime = new Date();
  const finalResult: ResultPayload = {
    ...resultPayload,
    endTime: endTime.toISOString(),
  };

  try {
    await publishResult(finalResult); // Send result back to RabbitMQ
    console.log(`[Processor] Sent result for job ${jobId}`);
    await message.ack(); // Acknowledge the original job message *after* processing
    console.log(`[Processor] Acknowledged job ${jobId}`);
  } catch (error) {
    console.error(
      `[Processor] Failed to publish result or ack job ${jobId}:`,
      error
    );
    // Consider implementing retry logic or moving the original message
    // to a dead-letter queue if ack/publish fails persistently.
    // For simplicity, we don't ack here, letting RabbitMQ potentially redeliver.
    // await message.nack(true); // or message.nack(false) to discard/dead-letter
  }
}
