// src/auth/AuthApiClient.ts
// Thin HTTP client for the SAML sign-in endpoints flambeau has actually built:
// POST /api/v1/auth/saml/start and POST /api/v1/auth/token. Institution selection is
// stored server-side under authTxnId, so the code exchange never needs the frontend
// to re-assert who it is.
export interface SamlStartResult {
  authTxnId: string;
  // Relative, e.g. "/saml2/authenticate?registrationId=tf-reader&authTxn=...".
  authorizationUrl: string;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MeResult {
  userId: string;
  institutionId?: string;
  roles: string[];
  collections: string[];
}

export class AuthApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /** POST /api/v1/auth/saml/start — institutionId travels as a query param, not a body. */
  async beginSamlSignIn(institutionId: string): Promise<SamlStartResult> {
    const url = `${this.baseUrl}/api/v1/auth/saml/start?institutionId=${encodeURIComponent(institutionId)}`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`saml/start failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as { authTxnId: string; authorizationUrl: string };
    return { authTxnId: body.authTxnId, authorizationUrl: body.authorizationUrl };
  }

  /** The absolute URL to open in the browser for the SAML redirect. */
  resolveAuthorizationUrl(authorizationUrl: string): string {
    return authorizationUrl.startsWith('http') ? authorizationUrl : `${this.baseUrl}${authorizationUrl}`;
  }

  /** POST /api/v1/auth/token — exchanges the one-time deep-link code for a token pair. */
  async exchangeCode(code: string): Promise<TokenResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      throw new Error(`token exchange failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
    return { accessToken: body.accessToken, refreshToken: body.refreshToken, expiresIn: body.expiresIn };
  }

  /** GET /api/v1/auth/me — the token exchange returns no identity, so this fills it in. */
  async getMe(accessToken: string): Promise<MeResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`me failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      userId: string;
      institutionId?: string;
      roles: string[];
      collections: string[];
    };
    return {
      userId: body.userId,
      institutionId: body.institutionId,
      roles: body.roles,
      collections: body.collections,
    };
  }
}
