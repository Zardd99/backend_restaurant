export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

export function err<E extends Error>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { success: true; value: T } {
  return result.success;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { success: false; error: E } {
  return !result.success;
}
