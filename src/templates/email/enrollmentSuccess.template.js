const enrollmentSuccessTemplate = (name, courseName, coursesUrl) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;text-align:center;">
      
      <div style="background:#2563eb; color:white; padding:20px; border-radius:8px 8px 0 0; margin:-30px -30px 30px -30px;">
        <h2 style="margin:0;">Enrollment Confirmed!</h2>
      </div>

      <p style="font-size:16px;color:#444;text-align:left;line-height:1.6;">
        Hi <b>${name}</b>, <br><br>
        Congratulations! You have successfully enrolled in <b>${courseName}</b>. We're excited to have you join our learning community and help you reach your tech goals.
      </p>

      <div style="background:#f0f7ff; border:2px solid #2563eb; border-radius:12px; padding:25px; margin:30px 0; text-align:center;">
        <p style="margin:0 0 10px 0; font-size:14px; color:#2563eb; font-weight:bold; text-transform:uppercase; tracking-wider;">You are now enrolled in:</p>
        <p style="margin:0; font-size:22px; font-weight:900; color:#1e293b; line-height:1.2;">${courseName}</p>
      </div>

      <p style="font-size:16px;color:#444;text-align:left;line-height:1.6;">
        Your course materials are ready and waiting for you. You can start learning right away at your own pace.
      </p>

      <div style="margin:35px 0;">
        <a href="${coursesUrl}" 
           style="
             display:inline-block;
             padding:16px 36px;
             background:#2563eb;
             color:white;
             text-decoration:none;
             border-radius:8px;
             font-size:16px;
             font-weight:bold;
             box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
           ">
           Start Learning Now
        </a>
      </div>

      <p style="font-size:14px;color:#64748b;margin-top:30px;">
        Need help? Reply to this email or visit our support center.
      </p>

      <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">

      <p style="font-size:12px;color:#999;">
        © ${new Date().getFullYear()} Technavyug Pvt. Ltd. All rights reserved.
      </p>

    </div>
  </div>
  `;
};

export default enrollmentSuccessTemplate;
