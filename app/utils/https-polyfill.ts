// This is a minimal polyfill for the Node.js 'https' module to make ws work in React Native
// It mostly re-exports our HTTP polyfill since they share most of the same API

import * as http from './http-polyfill';
import { Agent as HttpAgent } from './http-polyfill';

// Re-export most HTTP functions as they're the same
export const request = http.request;
export const get = http.get;
export const createServer = http.createServer;
export const METHODS = http.METHODS;
export const STATUS_CODES = http.STATUS_CODES;

// Export HTTPS-specific Agent class (minimal implementation)
export class Agent extends HttpAgent {
  constructor(options?: any) {
    super(options);
  }
}

// Define a default export to satisfy Expo Router
export default {
  request,
  get,
  createServer,
  METHODS,
  STATUS_CODES,
  Agent
}; 