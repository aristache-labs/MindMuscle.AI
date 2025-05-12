// This is a minimal polyfill for the Node.js 'net' module to make ws work in React Native
// It provides just enough functionality to prevent errors when ws tries to use net module

class Socket {
  connecting: boolean;
  destroyed: boolean;
  writable: boolean;
  readable: boolean;

  constructor() {
    this.connecting = false;
    this.destroyed = true;
    this.writable = false;
    this.readable = false;
  }

  connect(): void {
    throw new Error('Socket.connect is not supported in React Native');
  }

  destroy(): Socket {
    this.destroyed = true;
    return this;
  }

  end(): Socket {
    return this;
  }

  setTimeout(): Socket {
    return this;
  }

  setNoDelay(): Socket {
    return this;
  }

  setKeepAlive(): Socket {
    return this;
  }

  write(): boolean {
    return false;
  }

  // Adding event emitter methods
  on(): Socket {
    return this;
  }

  once(): Socket {
    return this;
  }

  removeListener(): Socket {
    return this;
  }

  removeAllListeners(): Socket {
    return this;
  }

  listeners(): any[] {
    return [];
  }
}

// Create a mock implementation of net.connect and net.createConnection
function connect(): Socket {
  return new Socket();
}

function createConnection(): Socket {
  return new Socket();
}

function createServer(): never {
  throw new Error('net.createServer is not supported in React Native');
}

// Export the mock implementations
export {
  Socket,
  connect,
  createConnection,
  createServer,
};

export const isIP = (): number => 0;
export const isIPv4 = (): boolean => false;
export const isIPv6 = (): boolean => false;

// Define a default export to satisfy Expo Router
export default {
  Socket,
  connect,
  createConnection,
  createServer,
  isIP,
  isIPv4,
  isIPv6
}; 