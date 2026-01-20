const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true", // false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendResetEmail(to, resetUrl) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const subject = "Password Reset - SFC Air FRMS";

  const text =
`আপনি আপনার পাসওয়ার্ড রিসেট করার অনুরোধ করেছেন।

রিসেট লিংক (৩০ মিনিটের জন্য বৈধ):
${resetUrl}

আপনি যদি অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।

— SFC Air FRMS`;

  const html = `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <h2 style="margin:0 0 10px">Password Reset</h2>
    <p>আপনি আপনার পাসওয়ার্ড রিসেট করার অনুরোধ করেছেন।</p>
    <p><b>রিসেট লিংক (৩০ মিনিটের জন্য বৈধ):</b></p>
    <p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111827;color:#fff;text-decoration:none;font-weight:700">
        Reset Password
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px">
      আপনি যদি অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:14px 0" />
    <p style="color:#6b7280;font-size:12px;margin:0">— SFC Air FRMS</p>
  </div>`;

  await transporter.sendMail({ from, to, subject, text, html });
}

module.exports = { sendResetEmail };
