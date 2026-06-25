const EMAIL_SENDERS = {
  NOREPLY: {
    address: process.env.NOREPLY_EMAIL || "noreply@technavyug.in",
    displayName: "Technavyug",
  },
  SUPPORT: {
    address:
      process.env.SUPPORT_EMAIL ||
      process.env.ADMIN_EMAIL ||
      "support@technavyug.com",
    displayName: "Technavyug Support",
  },
};

const getFromAddress = (type = "noreply") => {
  const key = type.toUpperCase();
  const sender = EMAIL_SENDERS[key] || EMAIL_SENDERS.NOREPLY;
  return `"${sender.displayName}" <${sender.address}>`;
};

export { EMAIL_SENDERS, getFromAddress };
