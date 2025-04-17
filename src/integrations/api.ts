// src/integrations/backend_api.ts
import { config } from "../config.ts";

const BASE_URL = config.backendApi.baseUrl;

export async function getData(query: string): Promise<any> {
  console.log(`Integration: Calling getData with query: ${query}`);
  const response = await fetch(`${BASE_URL}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(
      `Backend API Error (getData): ${response.status} ${await response
        .text()}`
    );
  }
  return await response.json();
}

export async function createRecord(record: any): Promise<string> {
  console.log("Integration: Calling createRecord with:", record);
  const response = await fetch(`${BASE_URL}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    throw new Error(
      `Backend API Error (createRecord): ${response.status} ${await response
        .text()}`
    );
  }
  const result = await response.json();
  if (!result || typeof result.recordId !== "string") {
    throw new Error("Backend API Error (createRecord): Invalid response format");
  }
  return result.recordId;
}
