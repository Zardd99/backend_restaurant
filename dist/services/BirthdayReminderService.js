"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BirthdayReminderService = void 0;
const User_1 = __importDefault(require("../models/User"));
const Notification_1 = __importDefault(require("../models/Notification"));
const STAFF_ROLES = [
    "admin",
    "manager",
    "chef",
    "waiter",
    "cashier",
];
const MANAGEMENT_ROLES = ["admin", "manager"];
class BirthdayReminderService {
    constructor(emailService, notifyWholeTeam = process.env.BIRTHDAY_NOTIFY_TEAM ===
        "true") {
        this.emailService = emailService;
        this.notifyWholeTeam = notifyWholeTeam;
    }
    async findTodaysBirthdays(reference = new Date()) {
        const month = reference.getMonth() + 1;
        const day = reference.getDate();
        return User_1.default.find({
            birthdate: { $ne: null },
            isActive: true,
            showBirthdayToOthers: true,
            $expr: {
                $and: [
                    { $eq: [{ $month: "$birthdate" }, month] },
                    { $eq: [{ $dayOfMonth: "$birthdate" }, day] },
                ],
            },
        })
            .select("name role email")
            .lean();
    }
    async resolveRecipients() {
        const roles = this.notifyWholeTeam ? STAFF_ROLES : MANAGEMENT_ROLES;
        const users = await User_1.default.find({
            role: { $in: roles },
            isActive: true,
            email: { $ne: null },
        })
            .select("name email")
            .lean();
        const recipients = new Map();
        for (const user of users) {
            if (user.email)
                recipients.set(user.email, { email: user.email, name: user.name });
        }
        for (const fallback of [process.env.ADMIN_EMAIL, process.env.MANAGER_EMAIL]) {
            if (fallback && !recipients.has(fallback)) {
                recipients.set(fallback, { email: fallback });
            }
        }
        return Array.from(recipients.values());
    }
    async sendBirthdayReminders(reference = new Date()) {
        const celebrants = await this.findTodaysBirthdays(reference);
        if (celebrants.length === 0) {
            return {
                celebrants: 0,
                recipients: 0,
                emailsSent: false,
                notificationsCreated: 0,
                notifications: [],
            };
        }
        const recipients = await this.resolveRecipients();
        let emailsSent = false;
        if (recipients.length > 0) {
            const emailResult = await this.emailService.sendBulk(recipients, this.buildEmailContent(celebrants));
            emailsSent = emailResult.success;
            if (!emailResult.success) {
                console.error("Birthday reminder email failed:", emailResult.error.message);
            }
        }
        const created = await Notification_1.default.insertMany(celebrants.map((celebrant) => ({
            type: "birthday_today",
            title: `🎂 ${celebrant.name}'s birthday is today!`,
            message: `Wish ${celebrant.name} (${celebrant.role}) a happy birthday.`,
            customerName: celebrant.name,
            itemCount: 0,
            timestamp: reference,
            read: false,
        })));
        const notifications = created.map((doc) => {
            var _a, _b, _c;
            return ({
                id: String(doc._id),
                type: "birthday_today",
                title: (_a = doc.title) !== null && _a !== void 0 ? _a : "",
                message: (_b = doc.message) !== null && _b !== void 0 ? _b : "",
                customerName: (_c = doc.customerName) !== null && _c !== void 0 ? _c : "",
                itemCount: 0,
                timestamp: new Date(doc.timestamp).toISOString(),
            });
        });
        return {
            celebrants: celebrants.length,
            recipients: recipients.length,
            emailsSent,
            notificationsCreated: created.length,
            notifications,
        };
    }
    buildEmailContent(celebrants) {
        const list = celebrants
            .map((celebrant) => `• ${celebrant.name} (${celebrant.role})`)
            .join("\n");
        const subject = celebrants.length === 1
            ? `🎂 Birthday today: ${celebrants[0].name}`
            : `🎂 ${celebrants.length} birthdays today`;
        return {
            subject,
            body: `The following team member${celebrants.length === 1 ? " has" : "s have"} a birthday today:\n\n${list}\n\nTake a moment to celebrate with them!\n\n— Restaurant Management System`,
            isHtml: false,
        };
    }
}
exports.BirthdayReminderService = BirthdayReminderService;
//# sourceMappingURL=BirthdayReminderService.js.map