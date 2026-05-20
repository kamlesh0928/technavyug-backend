const coursePurchaseAdminTemplate = (
  userName,
  userEmail,
  courseName,
  amount,
) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;">

      <div style="background:#1e40af; color:white; padding:20px; border-radius:8px 8px 0 0; margin:-30px -30px 30px -30px; text-align:center;">
        <h2 style="margin:0;">New Course Purchase</h2>
      </div>

      <p style="font-size:16px;color:#444;line-height:1.6;">
        A new course purchase has been made on the platform.
      </p>

      <table style="width:100%; border-collapse:collapse; margin:20px 0;">
        <tr>
          <td style="padding:10px; border-bottom:1px solid #eee; font-weight:bold; color:#555;">Student</td>
          <td style="padding:10px; border-bottom:1px solid #eee; color:#333;">${userName} (${userEmail})</td>
        </tr>
        <tr>
          <td style="padding:10px; border-bottom:1px solid #eee; font-weight:bold; color:#555;">Course</td>
          <td style="padding:10px; border-bottom:1px solid #eee; color:#333;">${courseName}</td>
        </tr>
        <tr>
          <td style="padding:10px; border-bottom:1px solid #eee; font-weight:bold; color:#555;">Amount</td>
          <td style="padding:10px; border-bottom:1px solid #eee; color:#059669; font-weight:bold;">Rs. ${amount}</td>
        </tr>
        <tr>
          <td style="padding:10px; font-weight:bold; color:#555;">Date</td>
          <td style="padding:10px; color:#333;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
        </tr>
      </table>

      <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;text-align:center;">
        &copy; ${new Date().getFullYear()} Technavyug Pvt. Ltd. Admin Notification.
      </p>
    </div>
  </div>
  `;
};

export default coursePurchaseAdminTemplate;
