// src/main.ts
import { consumeJobs, closeAmqp } from "./amqp/client.ts";
import { processJob } from "./jobs/processor.ts";
import { config } from "./config.ts"; // Load config early

console.log("Starting Deno Script Runner...");
console.log("Configuration loaded:", config); // Be careful logging sensitive parts

async function main() {
  try {
    // Start consuming jobs from RabbitMQ, passing the processor function
    await consumeJobs(processJob);

    // Keep the runner alive
    console.log("Runner started successfully. Listening for jobs...");
  } catch (error) {
    console.error("Failed to start runner:", error);
    await closeAmqp(); // Attempt graceful shutdown
    Deno.exit(1);
  }

  // Graceful shutdown handling
  Deno.addSignalListener("SIGINT", async () => {
    console.log("\nReceived SIGINT. Shutting down gracefully...");
    await closeAmqp();
    console.log("Shutdown complete.");
    Deno.exit(0);
  });

  Deno.addSignalListener("SIGTERM", async () => {
    console.log("Received SIGTERM. Shutting down gracefully...");
    await closeAmqp();
    console.log("Shutdown complete.");
    Deno.exit(0);
  });
}

main();
