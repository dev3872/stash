import multer from 'multer';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'That API route does not exist.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Auth0 JWT errors (express-oauth2-jwt-bearer)
  if (err?.name === 'UnauthorizedError' || err?.name === 'InvalidTokenError' || err?.status === 401) {
    const message = err.name === 'InvalidTokenError'
      ? 'Your session is invalid or has expired. Sign in again.'
      : 'Sign in to do that.';
    return res.status(401).json({ error: message });
  }
  if (err?.name === 'InvalidRequestError') {
    return res.status(401).json({ error: 'The authorization header is malformed. Sign in again.' });
  }
  if (err?.name === 'InsufficientScopeError') {
    return res.status(403).json({ error: "You don't have access to that." });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'PDFs must be 15 MB or smaller.'
      : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Upload a single PDF in the "file" field.'
        : 'The upload could not be processed.';
    return res.status(400).json({ error: message });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(400).json({ error: 'The request body is too large.' });
  }

  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ error: first?.message || 'Some fields are invalid.' });
  }

  if (err?.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
