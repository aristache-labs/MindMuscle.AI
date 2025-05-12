// This is a minimal polyfill for the Node.js 'http' module to make ws work in React Native
// It provides just enough functionality to prevent errors when ws tries to use http module

import { EventEmitter } from 'events';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  [key: string]: any;
}

interface ServerResponse {
  statusCode: number;
  headers: Record<string, string>;
}

class ClientRequest extends EventEmitter {
  constructor(url: string | RequestOptions, callback?: (res: ServerResponse) => void) {
    super();
    
    // If callback is provided, trigger it with a mock response
    if (callback) {
      setTimeout(() => {
        const res: ServerResponse = {
          statusCode: 200,
          headers: {},
        };
        callback(res);
      }, 0);
    }
  }

  write(data: any): boolean {
    return true;
  }

  end(): this {
    this.emit('finish');
    return this;
  }

  abort(): void {
    this.emit('abort');
  }

  setTimeout(timeout: number): this {
    return this;
  }

  setNoDelay(): this {
    return this;
  }

  setSocketKeepAlive(): this {
    return this;
  }
}

class Server extends EventEmitter {
  listen(): this {
    throw new Error('HTTP Server is not supported in React Native');
  }

  close(): this {
    return this;
  }
}

export function createServer(): Server {
  return new Server();
}

export function get(url: string, options?: RequestOptions, callback?: (res: ServerResponse) => void): ClientRequest {
  return new ClientRequest(url, callback);
}

export function request(url: string | RequestOptions, callback?: (res: ServerResponse) => void): ClientRequest {
  return new ClientRequest(url, callback);
}

// Export other common HTTP constants that ws might use
export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
export const STATUS_CODES: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

// Export Agent class (minimal implementation)
export class Agent {
  constructor(options?: any) {}
  
  destroy(): void {}
}

// Define a default export to satisfy Expo Router
export default {
  createServer,
  get,
  request,
  METHODS,
  STATUS_CODES,
  Agent
}; 