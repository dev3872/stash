export const config = {
  auth0Domain: (import.meta.env.VITE_AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE || '',
  apiUrl: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, ''),
};

export const missingConfig = [
  ['VITE_AUTH0_DOMAIN', config.auth0Domain],
  ['VITE_AUTH0_CLIENT_ID', config.auth0ClientId],
  ['VITE_AUTH0_AUDIENCE', config.auth0Audience],
  ['VITE_API_URL', config.apiUrl],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);
