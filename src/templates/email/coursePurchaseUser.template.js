const coursePurchaseUserTemplate = (name, courseName, amount, coursesUrl) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;text-align:center;">

      <div style="background:#059669; color:white; padding:20px; border-radius:8px 8px 0 0; margin:-30px -30px 30px -30px;">
        <h2 style="margin:0;">Purchase Confirmed</h2>
      </div>

      <p style="font-size:16px;color:#444;text-align:left;line-height:1.6;">
        Hi <b>${name}</b>, <br><br>
        Your payment of <b>Rs. ${amount}</b> has been received. You now have full access to the course below.
      </p>

      <div style="background:#f0fdf4; border:2px solid #059669; border-radius:12px; padding:25px; margin:30px 0; text-align:center;">
        <p style="margin:0 0 10px 0; font-size:14px; color:#059669; font-weight:bold; text-transform:uppercase;">Course Purchased:</p>
        <p style="margin:0; font-size:22px; font-weight:900; color:#1e293b; line-height:1.2;">${courseName}</p>
      </div>

      <div style="margin:35px 0;">
        <a href="${coursesUrl}"
           style="display:inline-block;padding:16px 36px;background:#059669;color:white;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
           Start Learning Now
        </a>
      </div>

      <p style="font-size:14px;color:#64748b;margin-top:30px;">
        Need help? Reply to this email or visit our support center.
      </p>

      <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">

      <p style="font-size:12px;color:#999;">
        &copy; ${new Date().getFullYear()} Technavyug Pvt. Ltd. All rights reserved.
      </p>

    </div>
  </div>
  `;
};

export default coursePurchaseUserTemplate;
