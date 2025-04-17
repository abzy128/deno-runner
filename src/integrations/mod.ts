// src/integrations/mod.ts
import * as backendApi from "./api.ts";
// Import other integration files here: import * as otherService from "./other_service.ts";

// Expose all available integration functions in a single object
// The keys here ('getData', 'createRecord') are what the script will use to call them.
export const availableIntegrations: Record<string, (...args: any[]) => Promise<any>> =
  {
    getData: backendApi.getData,
    createRecord: backendApi.createRecord,
    // otherServiceFunction: otherService.someFunction,
  };
