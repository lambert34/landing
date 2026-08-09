export interface G64CorsOptions {
  credentials: true;
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void,
  ) => void;
}

export function createCorsOptions(webUrl: string): G64CorsOptions {
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || origin === webUrl) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'));
    },
  };
}
