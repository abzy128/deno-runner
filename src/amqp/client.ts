// src/amqp/client.ts
import { AMQPClient, AMQPChannel, queue } from "@nashaddams/amqp";
import { config } from "../config.ts";
import type { ResultPayload } from "../types/index.ts";
import type { ConsumeResult } from "amqp"; // Import ConsumeResult type

let connection: AMQPClient | null = null;
let channel: AMQPChannel | null = null;

async function connectAmqp(): Promise<AMQPChannel> {
  if (channel) {
    return channel;
  }
  try {
    const { hostname, port, username, password } = config.rabbitMQ;
    const url = `amqp://${username}:${password}@${hostname}:${port}`;
    connection = new AMQPClient(url);
    await connection.connect();
    console.log("[AMQP] Connected successfully.");
    channel = await connection.channel();
    console.log("[AMQP] Channel created.");

    // Ensure queues exist and are durable
    await channel.queueDeclare({
      queue: config.rabbitMQ.jobQueue,
      durable: true,
    });
    await channel.queueDeclare({
      queue: config.rabbitMQ.resultQueue,
      durable: true,
    });
    console.log(
      `[AMQP] Queues '${config.rabbitMQ.jobQueue}' and '${config.rabbitMQ.resultQueue}' declared.`
    );

    // Set prefetch count (process one message at a time per runner instance)
    await channel.qos({ prefetchCount: 1 });
    console.log("[AMQP] QoS prefetch count set to 1.");

    connection.closed().then(() => {
      console.error("[AMQP] Connection closed.");
      connection = null;
      channel = null;
      // Implement reconnection logic if needed
      // Deno.exit(1); // Or attempt reconnect
    }).catch((err) => {
      console.error("[AMQP] Connection closed error:", err);
      connection = null;
      channel = null;
      // Deno.exit(1); // Or attempt reconnect
    });

    return channel;
  } catch (error) {
    console.error("[AMQP] Connection failed:", error);
    throw error; // Re-throw to prevent startup if connection fails
  }
}

export async function consumeJobs(
  onMessageCallback: (message: ConsumeResult) => Promise<void>
): Promise<void> {
  const ch = await connectAmqp();
  console.log(
    `[*] Waiting for messages in ${config.rabbitMQ.jobQueue}. To exit press CTRL+C`
  );
  await ch.consume(
    { queue: config.rabbitMQ.jobQueue, noAck: false }, // Ensure noAck is false
    async (message) => {
      // Wrap callback in error handling
      try {
        await onMessageCallback(message);
      } catch (error) {
        console.error(
          "[AMQP] Error during message processing callback:",
          error
        );
        // Decide if you should nack the message based on the error
        // For safety, we might not ack/nack here if the callback failed unexpectedly
        // await message.nack(false); // false = discard/dead-letter
      }
    }
  );
}

export async function publishResult(result: ResultPayload): Promise<void> {
  const ch = await connectAmqp();
  const payload = JSON.stringify(result);
  await ch.basicPublish(
    { routingKey: config.rabbitMQ.resultQueue },
    { contentType: "application/json", deliveryMode: 2 }, // deliveryMode 2 = persistent
    new TextEncoder().encode(payload)
  );
}

export async function closeAmqp(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
      console.log("[AMQP] Channel closed.");
    }
    if (connection) {
      await connection.close();
      connection = null;
      console.log("[AMQP] Connection closed.");
    }
  } catch (error) {
    console.error("[AMQP] Error closing connection:", error);
  }
}
