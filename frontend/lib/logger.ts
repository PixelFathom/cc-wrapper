import { Logger } from '@logtail/next';

// Create a singleton logger instance for use across the application
const logger = new Logger();

// Export the logger instance
export { logger };

// Export a hook-friendly version for client components
export function getLogger() {
  return logger;
}

// Helper for logging with context
export function logWithContext(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
) {
  const enrichedContext = {
    ...context,
    timestamp: new Date().toISOString(),
    service: 'frontend',
  };

  switch (level) {
    case 'debug':
      logger.debug(message, enrichedContext);
      break;
    case 'info':
      logger.info(message, enrichedContext);
      break;
    case 'warn':
      logger.warn(message, enrichedContext);
      break;
    case 'error':
      logger.error(message, enrichedContext);
      break;
  }
}

// Convenience methods
export const log = {
  debug: (message: string, context?: Record<string, unknown>) =>
    logWithContext('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    logWithContext('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    logWithContext('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    logWithContext('error', message, context),

  // Flush logs (important for server components)
  flush: () => logger.flush(),
};

export default log;
