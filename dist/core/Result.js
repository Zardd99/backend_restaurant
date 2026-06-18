"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Err = exports.Ok = void 0;
const Ok = (value) => ({ ok: true, value });
exports.Ok = Ok;
const Err = (error) => ({ ok: false, error });
exports.Err = Err;
//# sourceMappingURL=Result.js.map