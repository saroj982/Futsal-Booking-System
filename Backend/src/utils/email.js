import { Resend } from "resend";
import config from "../config/config.js";

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

const sendEmail = async ({ recipient, subject, html }) => {
  if (!resend) {
    console.warn("Resend API key not configured — skipping email to:", recipient);
    return null;
  }

  try {
    const result = await resend.emails.send({
      from: config.resend.fromEmail,
      to: recipient,
      subject,
      html,
    });
    return result;
  } catch (error) {
    console.error("Failed to send email to", recipient, error.message);
    throw error;
  }
};

export default sendEmail;
