export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private isDevelopment = process.env.NODE_ENV === 'development';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(entry: LogEntry): void {
    // In production, send logs to a logging service like sentry or datadog
    // can just use console for development
    if (this.isDevelopment) {
      const { level, message, timestamp, context, error } = entry;
      const logMessage = `[${timestamp.toISOString()}] ${level}: ${message}`;

      switch (level) {
        case LogLevel.DEBUG:
          if (context) {
            console.debug(logMessage, context);
          } else {
            console.debug(logMessage);
          }
          break;
        case LogLevel.INFO:
          if (context) {
            console.info(logMessage, context);
          } else {
            console.info(logMessage);
          }
          break;
        case LogLevel.WARN:
          if (context) {
            console.warn(logMessage, context);
          } else {
            console.warn(logMessage);
          }
          break;
        case LogLevel.ERROR:
          if (context && error) {
            console.error(logMessage, context, error);
          } else if (context) {
            console.error(logMessage, context);
          } else if (error) {
            console.error(logMessage, error);
          } else {
            console.error(logMessage);
          }
          break;
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date(),
      context
    });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      context
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: LogLevel.WARN,
      message,
      timestamp: new Date(),
      context
    });
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    this.log({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      context,
      error
    });
  }
}

export const logger = Logger.getInstance();
