export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UnreachableError extends Error {
  constructor(message?: string) {
    super(`entered unreachable code: ${message}`);
  }
}

export const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

export const mix = (x: number, y: number, a: number) => x * (1 - a) + y * a;

export const genRandomStringID = globalThis.crypto
  ? () => crypto.randomUUID()
  : () => {
      const s4 = () =>
        Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      return `${s4()}${s4()}-${s4()}${s4()}-${s4()}${s4()}-${s4()}${s4()}`;
    };

(globalThis as any).dbg = (x: any) => {
  console.log(x);
  return x;
};

declare global {
  function dbg<T>(arg: T): T;
}
