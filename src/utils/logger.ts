type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const write = (level: LogLevel, scope: string, message: string, error?: unknown): void => {
  const prefix = `${level} ${scope}: ${message}`;
  if (level === 'ERROR') {
    if (error) {
      console.error(prefix, error);
      return;
    }
    console.error(prefix);
    return;
  }
  if (level === 'WARN') {
    if (error) {
      console.warn(prefix, error);
      return;
    }
    console.warn(prefix);
    return;
  }
  console.log(prefix);
};

export const logger = Object.freeze({
  info: (scope: string, message: string): void => {
    write('INFO', scope, message);
  },
  warn: (scope: string, message: string, error?: unknown): void => {
    write('WARN', scope, message, error);
  },
  error: (scope: string, message: string, error?: unknown): void => {
    write('ERROR', scope, message, error);
  }
});
