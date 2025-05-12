/**
 * HTTPS Module Shim for React Native
 * 
 * This is a minimal implementation to satisfy dependencies that require 
 * Node's HTTPS module but don't actually use its functionality in RN
 */

// Import our HTTP shim to extend it
const http = require('./http-shim');
// Add ES module import for Expo Router compatibility
import httpDefault from './http-shim';

// Create a copy of HTTP methods
const httpsShim = {
  ...http,
  
  // Override any HTTPS-specific methods
  createServer: function() {
    console.warn('https.createServer is stubbed in React Native');
    return new http.Server();
  },
  
  request: function() {
    console.warn('https.request is stubbed in React Native');
    return {};
  },
  
  get: function() {
    console.warn('https.get is stubbed in React Native');
    return {};
  },
  
  // Add any HTTPS-specific properties
  globalAgent: {},
  
  // TLS-related options that might be expected
  Agent: class HttpsAgent extends http.Agent {
    constructor(options) {
      super(options);
      console.warn('https.Agent is stubbed in React Native');
    }
  }
};

// Export as both CommonJS and ES module
module.exports = httpsShim;

// Define a default export to satisfy Expo Router
export default httpsShim; 