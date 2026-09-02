// src/config/auth.ts
// Builds the AuthApiClient against EXPO_PUBLIC_FLAMBEAU_BASE_URL — the same backend
// base URL config/licence.ts uses for the 'api' licence source, since auth and licence
// are both flambeau endpoints on the same Spring Boot process.
import { AuthApiClient } from '@/auth/AuthApiClient';

let cached: AuthApiClient | undefined;

export function getAuthApiClient(): AuthApiClient {
  if (cached !== undefined) return cached;

  const raw = process.env.EXPO_PUBLIC_FLAMBEAU_BASE_URL;
  if (raw === undefined || raw.trim() === '') {
    throw new Error('EXPO_PUBLIC_FLAMBEAU_BASE_URL must be set to sign in for real.');
  }

  cached = new AuthApiClient(raw.trim());
  return cached;
}
