import { Request, Response, NextFunction } from "express";

/**
 * Global NoSQL-injection guard.
 *
 * Mongoose query operators are object keys that begin with `$` (`$where`,
 * `$gt`, …) or contain a `.` (dotted-path projection). A request body of
 * `{ "email": { "$gt": "" } }` would otherwise match every document. This
 * middleware recursively strips any such key from `req.body`, `req.params`,
 * and `req.query` so attacker-controlled operators never reach a query.
 *
 * Express 5 exposes `req.query` as a read-only getter, so we mutate the
 * existing objects in place (deleting offending keys) rather than reassigning.
 */

const FORBIDDEN_KEY_PATTERN = /^\$|\./;

function stripForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      stripForbiddenKeys(entry);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) {
        delete record[key];
        continue;
      }
      stripForbiddenKeys(record[key]);
    }
  }
}

export function mongoSanitize(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body) stripForbiddenKeys(req.body);
  if (req.params) stripForbiddenKeys(req.params);
  if (req.query) stripForbiddenKeys(req.query);
  next();
}
