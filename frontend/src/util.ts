export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UnreachableError extends Error {
  constructor(message?: string) {
    super(`entered unreachable code: ${message}`);
  }
}

export const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

export const mix = (x: number, y: number, a: number) => x * (1 - a) + y * a;
