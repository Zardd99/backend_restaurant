"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSupportMessage = void 0;
const dependencies_1 = require("../config/dependencies");
const SUPPORT_EMAIL = "c.sakda.chin@gmail.com";
function validateBody(body) {
    const { name, email, subject, message } = body;
    if (!(name === null || name === void 0 ? void 0 : name.trim()))
        return "Name is required";
    if (!(email === null || email === void 0 ? void 0 : email.trim()) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return "Valid email is required";
    if (!(subject === null || subject === void 0 ? void 0 : subject.trim()))
        return "Subject is required";
    if (!(message === null || message === void 0 ? void 0 : message.trim()) || message.trim().length < 10)
        return "Message must be at least 10 characters";
    if (message.length > 2000)
        return "Message must be under 2000 characters";
    return null;
}
const sendSupportMessage = async (req, res) => {
    const validationError = validateBody(req.body);
    if (validationError) {
        res.status(400).json({ success: false, message: validationError });
        return;
    }
    const { name, email, subject, message } = req.body;
    try {
        const emailService = dependencies_1.DependencyContainer.getInstance().resolve("EmailService");
        const htmlBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
  <h2 style="color: #111; margin-bottom: 4px;">New Support Request</h2>
  <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Received via Restaurant Management System Help Page</p>

  <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
    <tr>
      <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 100px;">From</td>
      <td style="padding: 8px 0; color: #111;">${name} &lt;${email}&gt;</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; font-weight: 600; color: #374151;">Subject</td>
      <td style="padding: 8px 0; color: #111;">${subject}</td>
    </tr>
  </table>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />

  <h3 style="color: #374151; margin-bottom: 8px;">Message</h3>
  <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; color: #111; white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</div>

  <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
    Reply directly to this email to respond to the user at ${email}.
  </p>
</div>`;
        const result = await emailService.send({ email: SUPPORT_EMAIL }, { subject: `[Support] ${subject}`, body: htmlBody, isHtml: true });
        if (!result.success) {
            res.status(500).json({
                success: false,
                message: "Failed to send message. Please try again later.",
            });
            return;
        }
        res.json({ success: true, message: "Message sent successfully." });
    }
    catch (_a) {
        res.status(500).json({
            success: false,
            message: "Support service unavailable. Please try again later.",
        });
    }
};
exports.sendSupportMessage = sendSupportMessage;
//# sourceMappingURL=supportController.js.map