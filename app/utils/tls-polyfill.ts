// This is a minimal polyfill for the Node.js 'tls' module to make ws work in React Native

// Import our net polyfill to extend its Socket class
import { Socket } from './net-polyfill';

class TLSSocket extends Socket {
  authorized: boolean;
  encrypted: boolean;

  constructor(socket?: any, options?: any) {
    super();
    this.authorized = false;
    this.encrypted = true;
  }

  getPeerCertificate(): Record<string, any> {
    return {};
  }

  getCipher(): { name: string; version: string } {
    return { name: 'NONE', version: 'NONE' };
  }
}

// Create a mock implementation of tls.connect
function connect(): TLSSocket {
  return new TLSSocket();
}

// Export the mock implementations
export {
  TLSSocket,
  connect,
};

export function createServer(): never {
  throw new Error('tls.createServer is not supported in React Native');
}

// Define a default export to satisfy Expo Router
export default {
  TLSSocket,
  connect,
  createServer
}; 