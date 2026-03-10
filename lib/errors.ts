export class LiveDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveDataUnavailableError";
  }
}

export class ProviderQuotaExceededError extends LiveDataUnavailableError {
  constructor(message: string) {
    super(message);
    this.name = "ProviderQuotaExceededError";
  }
}

export function isLiveDataUnavailableError(error: unknown): error is LiveDataUnavailableError {
  return error instanceof LiveDataUnavailableError;
}

export function isProviderQuotaExceededError(error: unknown): error is ProviderQuotaExceededError {
  return error instanceof ProviderQuotaExceededError;
}
