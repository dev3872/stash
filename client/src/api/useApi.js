import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation } from 'react-router';
import { ApiError, apiFetch } from './client.js';

/**
 * Returns `request` (adds the access token when signed in) and `login`
 * (sends the visitor through Auth0 and back to the current page).
 */
export function useApi() {
  const { isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const location = useLocation();

  const login = useCallback(
    (returnTo) => loginWithRedirect({ appState: { returnTo: returnTo || `${location.pathname}${location.search}` } }),
    [loginWithRedirect, location.pathname, location.search]
  );

  const request = useCallback(
    async (path, { auth = false, ...options } = {}) => {
      let token;
      if (isAuthenticated) {
        try {
          token = await getAccessTokenSilently();
        } catch (err) {
          if (auth) {
            await login();
            throw new ApiError(401, 'Your session expired. Sign in again.');
          }
          console.warn('Continuing without a token:', err?.error || err);
        }
      } else if (auth) {
        await login();
        throw new ApiError(401, 'Sign in to do that.');
      }

      try {
        return await apiFetch(path, { ...options, token });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401 && auth) await login();
        throw err;
      }
    },
    [isAuthenticated, getAccessTokenSilently, login]
  );

  return { request, login, isAuthenticated, authLoading: isLoading };
}
