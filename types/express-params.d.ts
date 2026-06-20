export {};

// Express 5 + @types/express@5 changed ParamsDictionary to string | string[].
// Route params are always strings at runtime — this augmentation narrows them back.
declare module "express-serve-static-core" {
  interface ParamsDictionary {
    [key: string]: string;
  }
}
