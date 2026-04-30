/**
 * Architecture hook for additional IdPs (Apple Sign in with Apple, Facebook, LINE Login).
 * Google is implemented in `GoogleOAuthService`; others add matching services + DB `provider` keys.
 */
export type OAuthProviderKey = "apple" | "facebook" | "google" | "line";

export interface OAuthUserProfileClaims {
  email: string;
  name: string;
  subject: string;
}

export interface OAuthProviderAdapter {
  readonly key: OAuthProviderKey;
  /** Whether this server has client id/secret configured. */
  isConfigured(): boolean;
}
