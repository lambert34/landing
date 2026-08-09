export interface HttpRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: { remoteAddress?: string };
  authUser?: unknown;
}
export interface HttpResponse {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
}
export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  domain?: string;
  maxAge?: number;
}
export function cookieValue(request: HttpRequest, name: string): string | undefined {
  const cookie = request.headers.cookie;
  if (typeof cookie !== 'string') return;
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
