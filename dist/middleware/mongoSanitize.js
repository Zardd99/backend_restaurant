"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoSanitize = mongoSanitize;
const FORBIDDEN_KEY_PATTERN = /^\$|\./;
function stripForbiddenKeys(value) {
    if (Array.isArray(value)) {
        for (const entry of value) {
            stripForbiddenKeys(entry);
        }
        return;
    }
    if (value !== null && typeof value === "object") {
        const record = value;
        for (const key of Object.keys(record)) {
            if (FORBIDDEN_KEY_PATTERN.test(key)) {
                delete record[key];
                continue;
            }
            stripForbiddenKeys(record[key]);
        }
    }
}
function mongoSanitize(req, _res, next) {
    if (req.body)
        stripForbiddenKeys(req.body);
    if (req.params)
        stripForbiddenKeys(req.params);
    if (req.query)
        stripForbiddenKeys(req.query);
    next();
}
//# sourceMappingURL=mongoSanitize.js.map