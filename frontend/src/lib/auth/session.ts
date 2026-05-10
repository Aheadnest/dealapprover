const REFRESH_TOKEN_KEY = "da_refresh_token";

let _accessToken: string | undefined;

export function setAccessToken(token: string | undefined): void {
  _accessToken = token;
}

export function getAccessToken(): string | undefined {
  return _accessToken;
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearSession(): void {
  _accessToken = undefined;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!_accessToken || !!getRefreshToken();
}
