export interface HealthResponse {
  status: 'ok';
}
export type Environment = 'development' | 'test' | 'production';
export type OtpPurpose = 'signup' | 'login';
export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
}
export interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}
export interface OtpRequestResponse {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}
