// Use React Native's built-in WebSocket implementation
import { NativeModules, Platform } from 'react-native';

// Define interfaces for TypeScript
interface WebSocketOptions {
  [key: string]: any;
}

interface ServerOptions {
  [key: string]: any;
}

// WebSocket constants that might be referenced
const WS_CONSTANTS = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
  
  // Events
  OPEN_EVENT: 'open',
  CLOSE_EVENT: 'close',
  MESSAGE_EVENT: 'message',
  ERROR_EVENT: 'error',
  
  // WebSocket opcodes
  CONTINUATION: 0,
  TEXT: 1,
  BINARY: 2,
  CLOSE: 8,
  PING: 9,
  PONG: 10
};

// Get the native WebSocket implementation
const getNativeWebSocket = () => {
  const ws = Platform.select({
    web: () => window.WebSocket,
    default: () => global.WebSocket,
  })();

  if (!ws) {
    throw new Error('WebSocket implementation not found');
  }

  return ws;
};

// Get the native WebSocket class
const NativeWebSocket = getNativeWebSocket();

// Create a WebSocket implementation that matches the expected API
class CustomWebSocket extends NativeWebSocket {
  options: WebSocketOptions;
  // Use a different property name to avoid conflict with native WebSocket's protocol property
  selectedProtocol: string | undefined;
  
  constructor(url: string, protocols?: string | string[], options?: WebSocketOptions) {
    super(url, protocols);
    // Add any custom properties expected by ws but not needed
    this.options = options || {};
    
    // Store protocol information
    if (typeof protocols === 'string') {
      this.selectedProtocol = protocols;
    } else if (Array.isArray(protocols) && protocols.length > 0) {
      this.selectedProtocol = protocols[0];
    }
    
    // Log secure vs insecure connections for debugging
    if (url.startsWith('wss://')) {
      console.log('Using secure WebSocket connection');
    } else {
      console.log('Using standard WebSocket connection');
    }
  }
  
  // Add any expected methods that the ws package might call
  ping(data?: any, mask?: boolean) {
    console.warn('CustomWebSocket.ping is stubbed in React Native');
    return true;
  }
  
  pong(data?: any, mask?: boolean) {
    console.warn('CustomWebSocket.pong is stubbed in React Native');
    return true;
  }
  
  terminate() {
    console.warn('Using close() instead of terminate() in React Native WebSocket');
    this.close();
  }
}

// Add these constants to the WebSocket class itself
Object.assign(CustomWebSocket, {
  CONNECTING: WS_CONSTANTS.CONNECTING,
  OPEN: WS_CONSTANTS.OPEN,
  CLOSING: WS_CONSTANTS.CLOSING,
  CLOSED: WS_CONSTANTS.CLOSED
});

// Mock Server class that would otherwise use Node's http module
class WebSocketServer {
  clients: Set<any>;
  options: ServerOptions;
  
  constructor(options: ServerOptions = {}) {
    console.warn('WebSocket.Server is only stubbed in React Native');
    this.clients = new Set();
    this.options = options;
  }

  on(event: string, callback: Function) {
    console.warn(`WebSocketServer.on('${event}') is stubbed in React Native`);
    return this;
  }

  close(callback?: Function) {
    console.warn('WebSocketServer.close() is stubbed in React Native');
    if (callback) callback();
    return this;
  }

  // Add any other methods that might be expected
  handleUpgrade() {
    console.warn('WebSocketServer.handleUpgrade() is stubbed in React Native');
  }

  shouldHandle() {
    console.warn('WebSocketServer.shouldHandle() is stubbed in React Native');
    return false;
  }
}

// Main module export to match ws package structure
const wsModule = {
  // The main WebSocket class
  WebSocket: CustomWebSocket,
  
  // Server-side stubs (not used in React Native)
  Server: WebSocketServer,
  
  // Additional utilities expected by ws
  createWebSocketStream: function() { 
    console.warn('createWebSocketStream is not implemented in React Native');
    return null; 
  },
  
  createServer: function(options: ServerOptions = {}) {
    console.warn('createServer is not implemented in React Native');
    return new WebSocketServer(options);
  },
  
  // Add in constants for direct imports
  ...WS_CONSTANTS
};

// Default export to match ws package
export default wsModule;

// Named exports for different import styles
export const WebSocket = CustomWebSocket;
export const Server = WebSocketServer;

// Export constants for direct imports
export const CONNECTING = WS_CONSTANTS.CONNECTING;
export const OPEN = WS_CONSTANTS.OPEN;
export const CLOSING = WS_CONSTANTS.CLOSING;
export const CLOSED = WS_CONSTANTS.CLOSED; 