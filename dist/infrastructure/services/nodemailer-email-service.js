"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodemailerEmailService = void 0;
const result_1 = require("../../shared/result");
const nodemailer_1 = __importDefault(require("nodemailer"));
class NodemailerEmailService {
    constructor(config) {
        this.isClosed = false;
        this.transporter = nodemailer_1.default.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: config.auth,
        });
        this.fromAddress = config.from;
    }
    async send(recipient, content) {
        try {
            await this.transporter.sendMail({
                from: this.fromAddress,
                to: recipient.email,
                subject: content.subject,
                text: !content.isHtml ? content.body : undefined,
                html: content.isHtml ? content.body : undefined,
            });
            return (0, result_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async sendBulk(recipients, content) {
        try {
            const promises = recipients.map((recipient) => this.send(recipient, content));
            await Promise.all(promises);
            return (0, result_1.ok)(undefined);
        }
        catch (error) {
            return (0, result_1.err)(new Error(`Failed to send bulk emails: ${error instanceof Error ? error.message : "Unknown error"}`));
        }
    }
    async close() {
        if (!this.isClosed) {
            try {
                await this.transporter.close();
                this.isClosed = true;
            }
            catch (error) {
                console.error("Error closing email service:", error);
            }
        }
    }
}
exports.NodemailerEmailService = NodemailerEmailService;
//# sourceMappingURL=nodemailer-email-service.js.map