import { auth } from 'express-oauth2-jwt-bearer';
import { upsertUserFromToken } from '../services/users.js';

/**
 * Builds the JWT middlewares. Tokens are verified against Auth0's JWKS using the
 * configured issuer (Auth0 domain) and audience (your API identifier).
 */
export function createAuth(authConfig) {
  const { audience, issuerBaseURL, issuer, jwksUri, userinfoUrl } = authConfig;
  const base = issuer && jwksUri
    ? { audience, issuer, jwksUri, tokenSigningAlg: 'RS256' }
    : { audience, issuerBaseURL, tokenSigningAlg: 'RS256' };

  const verifyRequired = auth({ ...base, authRequired: true });
  const verifyOptional = auth({ ...base, authRequired: false });

  async function attachUser(req) {
    const payload = req.auth?.payload;
    if (!payload?.sub) return;
    req.user = await upsertUserFromToken(payload, req.auth.token, userinfoUrl);
  }

  const requireAuth = [
    verifyRequired,
    async (req, _res, next) => {
      await attachUser(req);
      next();
    },
  ];

  const optionalAuth = [
    verifyOptional,
    async (req, _res, next) => {
      await attachUser(req);
      next();
    },
  ];

  return { requireAuth, optionalAuth };
}
