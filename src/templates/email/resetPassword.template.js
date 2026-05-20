const resetPasswordTemplate = (name, resetUrl) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;text-align:center;">

      <h2 style="color:#2563eb;">Password Reset Request</h2>

      <p style="font-size:16px;color:#444;">
        Hi <b>${name}</b>, <br><br>
        We received a request to reset your password. Click the button below to set a new password.
      </p>

      <a href="${resetUrl}"
         style="
           display:inline-block;
           padding:14px 28px;
           background:#2563eb;
           color:white;
           text-decoration:none;
           border-radius:6px;
           font-size:16px;
           margin-top:20px;
         ">
         Reset Password
      </a>

      <p style="font-size:14px;color:#777;margin-top:30px;">
        This link will expire in 15 minutes. If you did not request a password reset, please ignore this email.
      </p>

      <hr style="margin:30px 0">

      <p style="font-size:12px;color:#999;">
        &copy; ${new Date().getFullYear()} Technavyug Pvt. Ltd. Platform
      </p>

    </div>
  </div>
  `;
};

export default resetPasswordTemplate;
