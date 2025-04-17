// src/config.ts
import { load } from "dotenv";

// Load .env file if present, otherwise use environment variables
const env = await load({ export: true });

function getEnvVar(key: string, defaultValue?: string): string {
  const value = Deno.env.get(key);
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const config = {
  rabbitMQ: {
    hostname: getEnvVar("RABBITMQ_HOST", "localhost"),
    port: parseInt(getEnvVar("RABBITMQ_PORT", "5672"), 10),
    username: getEnvVar("RABBITMQ_USER", "guest"),
    password: getEnvVar("RABBITMQ_PASS", "guest"),
    jobQueue: getEnvVar("JOB_QUEUE", "script_jobs"),
    resultQueue: getEnvVar("RESULT_QUEUE", "script_results"),
  },
  backendApi: {
    baseUrl: getEnvVar("BACKEND_API_BASE_URL"),
  },
  runner: {
    // Timeout for script execution in milliseconds
    executionTimeoutMs: parseInt(getEnvVar("EXECUTION_TIMEOUT_MS", "30000")), // 30 seconds
  },
} as const; // Use 'as const' for better type inference
