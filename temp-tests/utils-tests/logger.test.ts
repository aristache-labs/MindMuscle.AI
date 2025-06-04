import { logger } from '../../app/utils/logger';

// Mock Sentry to avoid initialization issues in tests
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  getCurrentHub: jest.fn(() => ({
    getClient: jest.fn(() => ({
      getOptions: jest.fn(() => ({})),
    })),
  })),
}));

describe('Logger', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('info method', () => {
    it('should log info messages to console', () => {
      const message = 'Test info message';
      const options = { context: { key: 'value' } };

      logger.info(message, options);

      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });

    it('should handle logging without options', () => {
      const message = 'Test info message without options';

      logger.info(message);

      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });
  });

  describe('warn method', () => {
    it('should log warnings to console', () => {
      const message = 'Test warning message';
      const options = { context: { warning: 'data' } };

      logger.warn(message, options);

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
    });
  });

  describe('error method', () => {
    it('should log errors to console', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      logger.error(message, error);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });

    it('should log error messages without error object', () => {
      const message = 'Test error message without error object';

      logger.error(message);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });
  });

  describe('debug method', () => {
    it('should log debug messages when debugging is enabled', () => {
      const message = 'Test debug message';
      const options = { context: { debug: 'data' } };

      // Mock isDebugging to return true
      jest.spyOn(logger, 'isDebugging').mockReturnValue(true);

      logger.debug(message, options);

      expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
    });
  });

  describe('utility methods', () => {
    it('should return debug flags', () => {
      const flags = logger.getDebugFlags();
      expect(typeof flags).toBe('object');
    });

    it('should check debugging status', () => {
      const isDebugging = logger.isDebugging();
      expect(typeof isDebugging).toBe('boolean');
    });
  });
});
