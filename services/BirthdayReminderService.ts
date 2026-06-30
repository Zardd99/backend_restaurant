import User, { IUser } from "../models/User";
import Notification from "../models/Notification";
import { EmailService, EmailRecipient } from "./email-service";

type StaffRole = IUser["role"];

export interface BirthdayNotificationPayload {
  id: string;
  type: "birthday_today";
  title: string;
  message: string;
  customerName: string;
  itemCount: number;
  timestamp: string;
}

export interface BirthdayReminderResult {
  celebrants: number;
  recipients: number;
  emailsSent: boolean;
  notificationsCreated: number;
  notifications: BirthdayNotificationPayload[];
}

interface Celebrant {
  name: string;
  role: string;
  email: string;
}

const STAFF_ROLES: StaffRole[] = [
  "admin",
  "manager",
  "chef",
  "waiter",
  "cashier",
];
const MANAGEMENT_ROLES: StaffRole[] = ["admin", "manager"];

/**
 * Finds employees whose birthday (month + day) is today and notifies the
 * recipient audience (management by default, or the whole team when
 * BIRTHDAY_NOTIFY_TEAM is enabled) by email and persisted in-app notifications.
 *
 * Celebrants who opted out via showBirthdayToOthers are excluded.
 */
export class BirthdayReminderService {
  constructor(
    private emailService: EmailService,
    private notifyWholeTeam: boolean = process.env.BIRTHDAY_NOTIFY_TEAM ===
      "true",
  ) {}

  async findTodaysBirthdays(reference: Date = new Date()): Promise<Celebrant[]> {
    const month = reference.getMonth() + 1;
    const day = reference.getDate();

    return User.find({
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
      .lean<Celebrant[]>();
  }

  private async resolveRecipients(): Promise<EmailRecipient[]> {
    const roles = this.notifyWholeTeam ? STAFF_ROLES : MANAGEMENT_ROLES;

    const users = await User.find({
      role: { $in: roles },
      isActive: true,
      email: { $ne: null },
    })
      .select("name email")
      .lean<{ name: string; email: string }[]>();

    const recipients = new Map<string, EmailRecipient>();
    for (const user of users) {
      if (user.email) recipients.set(user.email, { email: user.email, name: user.name });
    }

    // Fallback to configured addresses so reminders still reach management even
    // before any staff accounts exist in the database.
    for (const fallback of [process.env.ADMIN_EMAIL, process.env.MANAGER_EMAIL]) {
      if (fallback && !recipients.has(fallback)) {
        recipients.set(fallback, { email: fallback });
      }
    }

    return Array.from(recipients.values());
  }

  async sendBirthdayReminders(
    reference: Date = new Date(),
  ): Promise<BirthdayReminderResult> {
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
      const emailResult = await this.emailService.sendBulk(
        recipients,
        this.buildEmailContent(celebrants),
      );
      emailsSent = emailResult.success;
      if (!emailResult.success) {
        console.error(
          "Birthday reminder email failed:",
          emailResult.error.message,
        );
      }
    }

    const created = await Notification.insertMany(
      celebrants.map((celebrant) => ({
        type: "birthday_today" as const,
        title: `🎂 ${celebrant.name}'s birthday is today!`,
        message: `Wish ${celebrant.name} (${celebrant.role}) a happy birthday.`,
        customerName: celebrant.name,
        itemCount: 0,
        timestamp: reference,
        read: false,
      })),
    );

    const notifications: BirthdayNotificationPayload[] = created.map((doc) => ({
      id: String(doc._id),
      type: "birthday_today",
      title: doc.title ?? "",
      message: doc.message ?? "",
      customerName: doc.customerName ?? "",
      itemCount: 0,
      timestamp: new Date(doc.timestamp).toISOString(),
    }));

    return {
      celebrants: celebrants.length,
      recipients: recipients.length,
      emailsSent,
      notificationsCreated: created.length,
      notifications,
    };
  }

  private buildEmailContent(celebrants: Celebrant[]) {
    const list = celebrants
      .map((celebrant) => `• ${celebrant.name} (${celebrant.role})`)
      .join("\n");

    const subject =
      celebrants.length === 1
        ? `🎂 Birthday today: ${celebrants[0].name}`
        : `🎂 ${celebrants.length} birthdays today`;

    return {
      subject,
      body: `The following team member${celebrants.length === 1 ? " has" : "s have"} a birthday today:\n\n${list}\n\nTake a moment to celebrate with them!\n\n— Restaurant Management System`,
      isHtml: false,
    };
  }
}
