import { test, expect, describe } from "bun:test";
import { debounce } from "./debounce.ts";

describe("debounce", () => {
  test("calls function after delay", async () => {
    let callCount = 0;
    const fn = () => callCount++;
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(callCount).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(callCount).toBe(1);
  });

  test("cancels previous call when called again quickly", async () => {
    let callCount = 0;
    const fn = () => callCount++;
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(callCount).toBe(1);
  });

  test("passes arguments correctly", async () => {
    let lastArgs: any[] = [];
    const fn = (...args: any[]) => {
      lastArgs = args;
    };
    const debouncedFn = debounce(fn, 50);

    debouncedFn("hello", 42, true);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(lastArgs).toEqual(["hello", 42, true]);
  });

  test("works with different argument types", async () => {
    let result = "";
    const fn = (a: string, b: number) => {
      result = `${a}-${b}`;
    };
    const debouncedFn = debounce(fn, 50);

    debouncedFn("test", 123);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(result).toBe("test-123");
  });

  test("handles rapid successive calls", async () => {
    let callCount = 0;
    const fn = () => callCount++;
    const debouncedFn = debounce(fn, 100);

    // Call 10 times rapidly
    for (let i = 0; i < 10; i++) {
      debouncedFn();
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(callCount).toBe(1);
  });
});