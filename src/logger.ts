import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';

// Log stages enum
export enum LogStage {
  REQUEST_RECEIVED = 'REQUEST_RECEIVED',
  AUTH_START = 'AUTH_START',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILED = 'AUTH_FAILED',
  PROVIDER_REQUEST = 'PROVIDER_REQUEST',
  PROVIDER_RESPONSE = 'PROVIDER_RESPONSE',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  RESPONSE_SENT = 'RESPONSE_SENT'
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  requestId: string;
  stage: LogStage;
  subKeyId?: string;
  model?: string;
  duration?: number;
  status?: number;
  details?: string;
}

// Log file path - store in current directory
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'access.log');

// Ensure log directory exists
fs.ensureDirSync(LOG_DIR);

// Append log entry to file
function appendToFile(entry: LogEntry): void {
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// Generate unique request ID
export function generateRequestId(): string {
  return randomUUID().substring(0, 8);
}

// Truncate sensitive data
export function truncateContent(content: string, maxLength: number = 100): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

// Structured logger function
export function log(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  console.log(json);
  appendToFile(entry);
}

// Convenience logging functions
export function createLogger(requestId: string) {
  return {
    log: (stage: LogStage, data: Partial<LogEntry>) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage,
        ...data
      });
    },

    logRequestReceived: (method: string, reqPath: string, model?: string) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.REQUEST_RECEIVED,
        model,
        details: `${method} ${reqPath}`
      });
    },

    logAuthStart: () => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.AUTH_START
      });
    },

    logAuthSuccess: (subKeyId: string, subKeyPrefix: string) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.AUTH_SUCCESS,
        subKeyId,
        details: `subKey prefix: ${subKeyPrefix}`
      });
    },

    logAuthFailed: (reason: string) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.AUTH_FAILED,
        details: reason
      });
    },

    logProviderRequest: (providerType: string, model: string, messageCount: number) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.PROVIDER_REQUEST,
        model,
        details: `provider: ${providerType}, messages: ${messageCount}`
      });
    },

    logProviderResponse: (status: number, duration: number, responseSize?: number) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.PROVIDER_RESPONSE,
        status,
        duration,
        details: responseSize ? `response size: ${responseSize}` : undefined
      });
    },

    logProviderError: (errorType: string, errorMessage: string, statusCode?: number) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.PROVIDER_ERROR,
        status: statusCode,
        details: `${errorType}: ${truncateContent(errorMessage)}`
      });
    },

    logResponseSent: (status: number, totalDuration: number) => {
      log({
        timestamp: new Date().toISOString(),
        requestId,
        stage: LogStage.RESPONSE_SENT,
        status,
        duration: totalDuration
      });
    }
  };
}
