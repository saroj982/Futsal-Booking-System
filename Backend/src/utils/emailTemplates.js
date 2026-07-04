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

export default { buildCustomerConfirmationEmail, buildOwnerNotificationEmail };
