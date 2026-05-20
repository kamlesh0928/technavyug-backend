const streakReminderTemplate = (name, currentStreak) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;text-align:center;">

      <div style="font-size:48px;margin-bottom:10px;">🔥</div>

      <h2 style="color:#e65100;">Don't Lose Your ${currentStreak}-Day Streak!</h2>

      <p style="font-size:16px;color:#444;">
        Hi <b>${name}</b>, <br><br>
        You've been on a <b style="color:#e65100;">${currentStreak}-day study streak</b> — that's amazing!
        But your streak is at risk. You haven't completed any lectures today yet.
      </p>

      <p style="font-size:14px;color:#666;margin-top:16px;">
        Your study day resets at <b>6:00 AM IST</b> tomorrow. Complete at least one lecture before then to keep your streak alive!
      </p>

      <a href="${process.env.FRONTEND_URL_1 || process.env.FRONTEND_URL_2}/student"
         style="
           display:inline-block;
           padding:14px 28px;
           background:linear-gradient(135deg, #e65100, #ff8f00);
           color:white;
           text-decoration:none;
           border-radius:8px;
           font-size:16px;
           font-weight:bold;
           margin-top:20px;
         ">
         Continue Learning Now
      </a>

      <div style="margin-top:30px;padding:16px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;">
        <p style="font-size:14px;color:#f57f17;margin:0;font-weight:bold;">
          🏆 Your longest streak: Keep pushing to beat your personal best!
        </p>
      </div>

      <hr style="margin:30px 0">

      <p style="font-size:12px;color:#999;">
        © ${new Date().getFullYear()} Technavyug Pvt. Ltd. Platform
      </p>

    </div>
  </div>
  `;
};

export default streakReminderTemplate;
