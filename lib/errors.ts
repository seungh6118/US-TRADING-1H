export class LiveDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveDataUnavailableError";
  }
}

export function isLiveDataUnavailableError(error: unknown): error is LiveDataUnavailableError {
  return error instanceof LiveDataUnavailableError;
}
