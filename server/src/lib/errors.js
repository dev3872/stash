export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const unauthorized = (message = 'Sign in to do that.') => new HttpError(401, message);
export const forbidden = (message = "You don't have access to that.") => new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
