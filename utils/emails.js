import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",    
      auth: {
        user: process.env.Email_USER,
        pass: process.env.Email_PASSWORD,    
      },
    });

    await transporter.sendMail({
      from: `"TALABATAK" <${process.env.Email_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent to:", to);
  } catch (error) {
    console.error("Error sending email:", error.message);
  }
};
