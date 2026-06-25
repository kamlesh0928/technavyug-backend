import sendEmail from "../services/email.service.js";
import Logger from "../utils/logger.js";

const submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Send email to admin
    const adminEmail = process.env.ADMIN_EMAIL || "admin@technavyug.com";
    const emailSubject = `New Contact Form Submission: ${subject}`;
    const emailContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #0f172a; text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">New Contact Submission</h2>
        <div style="margin-top: 20px;">
            <p><strong>From:</strong> ${name} (&lt;${email}&gt;)</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #0f172a; margin-top: 10px; font-style: italic; white-space: pre-wrap;">
              ${message}
            </div>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">
          Technavyug Engineering Platform<br/>
          Contact Form System
        </p>
      </div>
    `;

    try {
      await sendEmail(adminEmail, emailSubject, emailContent);
    } catch (emailError) {
      Logger.error("Failed to send contact email to admin", emailError);
    }

    // Send confirmation email to user
    const userSubject = `We received your message - Technavyug`;
    const userContent = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #0f172a; text-align: center;">Message Received</h2>
        <p>Hi ${name},</p>
        <p>Thank you for reaching out to <strong>Technavyug</strong>! We've received your message regarding "<strong>${subject}</strong>".</p>
        <p>Our team will review your inquiry and get back to you as soon as possible (usually within 24-48 hours).</p>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #dcfce7; margin-top: 20px;">
            <p style="margin: 0; color: #166534; font-size: 14px; text-align: center; font-weight: bold;">We'll be in touch soon!</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">
          Technavyug Engineering Platform<br/>
          Building the future of engineering education.
        </p>
      </div>
    `;

    try {
      await sendEmail(email, userSubject, userContent, "support");
    } catch (emailError) {
      Logger.error("Failed to send confirmation email to user", emailError);
    }

    Logger.info("Contact form submitted", { name, email, subject });
    res
      .status(200)
      .json({ message: "Your message has been sent successfully!" });
  } catch (error) {
    Logger.error("Error submitting contact form", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  submitContactForm,
};
