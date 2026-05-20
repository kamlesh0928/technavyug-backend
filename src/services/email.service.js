import nodemailer from "nodemailer";
import Logger from "../utils/logger.js";

if (
  !process.env.SMTP_HOST ||
  !process.env.SMTP_USER ||
  !process.env.SMTP_PASS
) {
  Logger.error("SMTP environment variables are missing!");
}

// Configure the SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from:
        process.env.SMTP_FROM_EMAIL ||
        '"Technavyug Education" <noreply@technavyug.com>',
      to,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    Logger.info(`Email sent successfully to ${to}`);
    return info;
  } catch (error) {
    Logger.error(`Failed to send email to ${to}`, error);
    throw new Error("Email delivery failed", { cause: error });
  }
};

export default sendEmail;
