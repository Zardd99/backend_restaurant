const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password",
  },
});

async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: '"Restaurant Inventory" <your-email@gmail.com>',
      to: "admin@restaurant.com",
      subject: "Test Email - Inventory System",
      text: "This is a test email from the inventory management system.",
      html: "<b>This is a test email from the inventory management system.</b>",
    });

    console.log("Email sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

testEmail();
