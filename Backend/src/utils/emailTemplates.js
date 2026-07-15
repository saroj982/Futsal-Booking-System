const formatHours = (hours) => {
  if (!hours?.length) return "N/A";
  return hours
    .sort((a, b) => a - b)
    .map((h) => `${h}:00 - ${h + 1}:00`)
    .join(", ");
};

export const buildCustomerConfirmationEmail = ({
  customerName,
  futsalName,
  date,
  hours,
  totalPrice,
  transactionRef,
}) => ({
  subject: `Booking Confirmed — ${futsalName}`,
  html: `
    <h2>Your futsal booking is confirmed!</h2>
    <p>Hi ${customerName},</p>
    <p>Thank you for your payment. Here are your booking details:</p>
    <ul>
      <li><strong>Venue:</strong> ${futsalName}</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time slots:</strong> ${formatHours(hours)}</li>
      <li><strong>Total paid:</strong> NPR ${totalPrice}</li>
      <li><strong>Reference:</strong> ${transactionRef || "N/A"}</li>
    </ul>
    <p>See you on the pitch!</p>
  `,
});

export const buildOwnerNotificationEmail = ({
  ownerName,
  customerName,
  customerEmail,
  futsalName,
  date,
  hours,
  totalPrice,
  transactionRef,
}) => ({
  subject: `New Booking — ${futsalName}`,
  html: `
    <h2>New paid booking at your venue</h2>
    <p>Hi ${ownerName},</p>
    <p>A customer has confirmed a booking at <strong>${futsalName}</strong>.</p>
    <ul>
      <li><strong>Customer:</strong> ${customerName} (${customerEmail})</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time slots:</strong> ${formatHours(hours)}</li>
      <li><strong>Amount:</strong> NPR ${totalPrice}</li>
      <li><strong>Reference:</strong> ${transactionRef || "N/A"}</li>
    </ul>
  `,
});

export const buildCustomerCancellationEmail = ({
  customerName,
  futsalName,
  date,
  hours,
  totalPrice,
  refundAmount,
  refundType,
  refundPercentage,
  reason,
}) => ({
  subject: `Booking Cancelled — ${futsalName}`,
  html: `
    <h2>Your booking has been cancelled</h2>
    <p>Hi ${customerName},</p>
    <p>Your booking at <strong>${futsalName}</strong> has been cancelled.</p>
    <ul>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time slots:</strong> ${formatHours(hours)}</li>
      <li><strong>Original amount:</strong> NPR ${totalPrice}</li>
      <li><strong>Refund:</strong> ${refundAmount > 0 ? `NPR ${refundAmount} (${refundPercentage}%)` : "No refund"}</li>
      <li><strong>Reason:</strong> ${reason || "No reason provided"}</li>
    </ul>
    <p>We have notified the venue owner about your cancellation.</p>
  `,
});

export const buildOwnerCancellationEmail = ({
  ownerName,
  customerName,
  customerEmail,
  futsalName,
  date,
  hours,
  totalPrice,
  refundAmount,
  refundType,
  refundPercentage,
  reason,
}) => ({
  subject: `Booking Cancelled by Customer — ${futsalName}`,
  html: `
    <h2>A booking was cancelled at your venue</h2>
    <p>Hi ${ownerName},</p>
    <p>A customer has cancelled a booking at <strong>${futsalName}</strong>.</p>
    <ul>
      <li><strong>Customer:</strong> ${customerName} (${customerEmail})</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time slots:</strong> ${formatHours(hours)}</li>
      <li><strong>Original amount:</strong> NPR ${totalPrice}</li>
      <li><strong>Refund amount:</strong> NPR ${refundAmount} (${refundPercentage}%)</li>
      <li><strong>Reason:</strong> ${reason || "No reason provided"}</li>
    </ul>
    <p>Please review the refund request in your owner dashboard and process it accordingly.</p>
  `,
});

export default {
  buildCustomerConfirmationEmail,
  buildOwnerNotificationEmail,
  buildCustomerCancellationEmail,
  buildOwnerCancellationEmail,
};
