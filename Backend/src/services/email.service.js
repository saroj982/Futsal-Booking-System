import sendEmail from "../utils/email.js";
import User from "../models/User.js";
import Futsal from "../models/Futsal.js";
import {
  buildCustomerConfirmationEmail,
  buildOwnerNotificationEmail,
  buildCustomerCancellationEmail,
  buildOwnerCancellationEmail,
} from "../utils/emailTemplates.js";

/**
 * Send confirmation emails to customer and futsal owner after successful payment.
 * Failures are logged but do not block the booking response.
 */
export async function sendBookingConfirmationEmails({
  userId,
  futsalId,
  date,
  hours,
  timeSlots,
  totalPrice,
  transactionRef,
}) {
  try {
    const slotHours = hours || timeSlots;
    const [customer, futsal] = await Promise.all([
      User.findById(userId).select("name email"),
      Futsal.findById(futsalId).populate("owner", "name email"),
    ]);

    if (!customer || !futsal) {
      console.warn("Cannot send booking emails — customer or futsal not found");
      return;
    }

    const owner = futsal.owner;
    const emailData = {
      futsalName: futsal.name,
      date,
      hours: slotHours,
      totalPrice,
      transactionRef,
    };

    const customerEmail = buildCustomerConfirmationEmail({
      customerName: customer.name,
      ...emailData,
    });

    await sendEmail({
      recipient: customer.email,
      subject: customerEmail.subject,
      html: customerEmail.html,
    });

    if (owner?.email) {
      const ownerEmail = buildOwnerNotificationEmail({
        ownerName: owner.name,
        customerName: customer.name,
        customerEmail: customer.email,
        ...emailData,
      });

      await sendEmail({
        recipient: owner.email,
        subject: ownerEmail.subject,
        html: ownerEmail.html,
      });
    }
  } catch (error) {
    console.error("sendBookingConfirmationEmails error:", error.message);
  }
}

export async function sendBookingCancellationEmails({
  userId,
  futsalId,
  date,
  hours,
  timeSlots,
  totalPrice,
  refundAmount,
  refundType,
  refundPercentage,
  reason,
}) {
  try {
    const slotHours = hours || timeSlots;
    const [customer, futsal] = await Promise.all([
      User.findById(userId).select("name email"),
      Futsal.findById(futsalId).populate("owner", "name email"),
    ]);

    if (!customer || !futsal) {
      console.warn("Cannot send cancellation emails — customer or futsal not found");
      return;
    }

    const owner = futsal.owner;
    const emailData = {
      futsalName: futsal.name,
      date,
      hours: slotHours,
      totalPrice,
      refundAmount,
      refundType,
      refundPercentage,
      reason,
    };

    const customerCancellationEmail = buildCustomerCancellationEmail({
      customerName: customer.name,
      ...emailData,
    });

    await sendEmail({
      recipient: customer.email,
      subject: customerCancellationEmail.subject,
      html: customerCancellationEmail.html,
    });

    if (owner?.email) {
      const ownerCancellationEmail = buildOwnerCancellationEmail({
        ownerName: owner.name,
        customerName: customer.name,
        customerEmail: customer.email,
        ...emailData,
      });

      await sendEmail({
        recipient: owner.email,
        subject: ownerCancellationEmail.subject,
        html: ownerCancellationEmail.html,
      });
    }
  } catch (error) {
    console.error("sendBookingCancellationEmails error:", error.message);
  }
}

export default {
  sendBookingConfirmationEmails,
  sendBookingCancellationEmails,
};
