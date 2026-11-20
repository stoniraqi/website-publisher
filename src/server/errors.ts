/** An error whose message a person may read, with the HTTP status it maps to. */
export class AppError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "That item") => new AppError(404, `${what} wasn't found.`);
export const forbidden = (message = "Your role doesn't allow that.") => new AppError(403, message);
export const invalid = (message: string) => new AppError(400, message);
