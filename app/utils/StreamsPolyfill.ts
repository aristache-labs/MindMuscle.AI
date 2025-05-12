/**
 * Minimal implementation of Web Streams API for React Native
 * This provides just enough functionality to avoid errors when modules try to use streams
 */

// Basic implementation of ReadableStream
class ReadableStream {
  constructor(underlyingSource?: any, strategy?: any) {
    // Minimal implementation
  }

  getReader() {
    return {
      read: async () => ({ done: true, value: undefined }),
      releaseLock: () => {},
      cancel: async () => {},
    };
  }
}

// Basic implementation of WritableStream
class WritableStream {
  constructor(underlyingSink?: any, strategy?: any) {
    // Minimal implementation
  }

  getWriter() {
    return {
      write: async () => {},
      close: async () => {},
      abort: async () => {},
      releaseLock: () => {},
    };
  }
}

// Basic implementation of TransformStream
class TransformStream {
  readable: ReadableStream;
  writable: WritableStream;

  constructor(transformer?: any, readableStrategy?: any, writableStrategy?: any) {
    this.readable = new ReadableStream();
    this.writable = new WritableStream();
  }
}

// Export both default and named exports
export {
  ReadableStream,
  WritableStream,
  TransformStream
};

export default {
  ReadableStream,
  WritableStream,
  TransformStream
}; 