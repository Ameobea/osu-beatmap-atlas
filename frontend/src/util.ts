export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UnreachableError extends Error {
  constructor(message?: string) {
    super(`entered unreachable code: ${message}`);
  }
}
