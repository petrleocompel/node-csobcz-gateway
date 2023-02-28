export type Logger = {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  log: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
};
