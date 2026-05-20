const verificationEmailTemplate = (name, verifyUrl) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;text-align:center;">

      <h2 style="color:#2563eb;">Welcome to Technavyug</h2>

      <p style="font-size:16px;color:#444;">
        Hi <b>${name}</b>, <br><br>
        Thank you for registering. Please verify your email address to activate your account.
      </p>

      <a href="${verifyUrl}"
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
         Verify Email
      </a>

      <p style="font-size:14px;color:#777;margin-top:30px;">
        If you did not create this account, please ignore this email.
      </p>

      <hr style="margin:30px 0">

      <p style="font-size:12px;color:#999;">
        © ${new Date().getFullYear()} Technavyug Pvt. Ltd. Platform
      </p>

    </div>
  </div>
  `;
};

export default verificationEmailTemplate;
