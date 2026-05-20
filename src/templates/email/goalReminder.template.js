const goalReminderTemplate = (
  name,
  goalName,
  completedLectures,
  targetLectures,
  daysRemaining,
) => {
  const progressPercent =
    targetLectures > 0
      ? Math.round((completedLectures / targetLectures) * 100)
      : 0;
  const remaining = targetLectures - completedLectures;

  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;text-align:center;">

      <div style="font-size:48px;margin-bottom:10px;">🎯</div>

      <h2 style="color:#2563eb;">Weekly Goal Progress Update</h2>

      <p style="font-size:16px;color:#444;">
        Hi <b>${name}</b>, <br><br>
        Here's how you're doing on your monthly goal${goalName ? ` "<b>${goalName}</b>"` : ""}:
      </p>

      <!-- Progress Bar -->
      <div style="margin:24px auto;max-width:400px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:6px;">
          <span>${completedLectures} completed</span>
          <span>${targetLectures} target</span>
        </div>
        <div style="width:100%;height:12px;background:#e0e7ff;border-radius:6px;overflow:hidden;">
          <div style="width:${Math.min(progressPercent, 100)}%;height:100%;background:linear-gradient(90deg,#2563eb,#06b6d4);border-radius:6px;"></div>
        </div>
        <p style="font-size:24px;font-weight:bold;color:#2563eb;margin-top:12px;">${progressPercent}%</p>
      </div>

      <div style="padding:16px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;margin:20px 0;">
        <p style="font-size:14px;color:#0369a1;margin:0;">
          📖 <b>${remaining}</b> more lecture${remaining !== 1 ? "s" : ""} to go &nbsp;|&nbsp;
          ⏰ <b>${daysRemaining}</b> day${daysRemaining !== 1 ? "s" : ""} remaining this month
        </p>
      </div>

      ${
        progressPercent >= 75
          ? `<p style="font-size:14px;color:#059669;font-weight:bold;">🌟 You're almost there! Keep up the great work!</p>`
          : progressPercent >= 50
            ? `<p style="font-size:14px;color:#d97706;font-weight:bold;">💪 Halfway there! Stay consistent to reach your goal.</p>`
            : `<p style="font-size:14px;color:#dc2626;font-weight:bold;">⚡ Time to pick up the pace! You can still make it!</p>`
      }

      <a href="${process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2}/student"
         style="
           display:inline-block;
           padding:14px 28px;
           background:linear-gradient(135deg, #2563eb, #06b6d4);
           color:white;
           text-decoration:none;
           border-radius:8px;
           font-size:16px;
           font-weight:bold;
           margin-top:16px;
         ">
         Resume Learning
      </a>

      <hr style="margin:30px 0">

      <p style="font-size:12px;color:#999;">
        © ${new Date().getFullYear()} Technavyug Platform
      </p>

    </div>
  </div>
  `;
};

export default goalReminderTemplate;
