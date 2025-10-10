"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    constructor(context) {
        this.context = context;
    }
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${this.context}]: ${message}`;
    }
    info(message) {
        console.log(this.formatMessage("INFO", message));
    }
    warn(message) {
        console.warn(this.formatMessage("WARN", message));
    }
    error(message) {
        console.error(this.formatMessage("ERROR", message));
    }
    debug(message) {
        if (process.env.DEBUG === "true") {
            console.debug(this.formatMessage("DEBUG", message));
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map