/**
 * HTTP Module Shim for React Native
 * 
 * This is a minimal implementation to satisfy dependencies that require 
 * Node's HTTP module but don't actually use its functionality in RN
 */

// Dummy request object
class IncomingMessage {
  constructor() {
    this.headers = {};
    this.method = 'GET';
    this.url = '';
    this.statusCode = 200;
    this.statusMessage = 'OK';
  }

  on(event, listener) {
    console.warn('IncomingMessage.on is stubbed in React Native');
    return this;
  }
  
  once(event, listener) {
    console.warn('IncomingMessage.once is stubbed in React Native');
    return this;
  }
  
  removeListener(event, listener) {
    return this;
  }
}

// Dummy response object
class ServerResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
  }
  
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  }
  
  getHeader(name) {
    return this.headers[name];
  }
  
  removeHeader(name) {
    delete this.headers[name];
    return this;
  }
  
  write(chunk) {
    console.warn('ServerResponse.write is stubbed in React Native');
    return true;
  }
  
  end(data) {
    console.warn('ServerResponse.end is stubbed in React Native');
    return this;
  }
  
  on(event, listener) {
    console.warn('ServerResponse.on is stubbed in React Native');
    return this;
  }
}

// Dummy server implementation
class Server {
  constructor() {
    console.warn('http.Server is stubbed in React Native');
  }
  
  listen(port) {
    console.warn('http.Server.listen is stubbed in React Native');
    return this;
  }
  
  close(callback) {
    console.warn('http.Server.close is stubbed in React Native');
    return this;
  }
  
  on(event, listener) {
    console.warn('http.Server.on is stubbed in React Native');
    return this;
  }
}

// Agent stub
class Agent {
  constructor() {}
}

// Stub for common http methods
const httpShim = {
  createServer: function() {
    console.warn('http.createServer is stubbed in React Native');
    return new Server();
  },
  
  request: function() {
    console.warn('http.request is stubbed in React Native');
    return {};
  },
  
  get: function() {
    console.warn('http.get is stubbed in React Native');
    return {};
  },
  
  Server,
  IncomingMessage,
  ServerResponse,
  Agent,
  
  STATUS_CODES: {
    200: 'OK',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  }
};

// Export as both CommonJS and ES module
module.exports = httpShim;

// Define a default export to satisfy Expo Router
export default httpShim; 