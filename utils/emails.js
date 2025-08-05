import asyncHandler from 'express-async-handler';
import transporter from './nodemailerConfig.js';
import { PASSWORD_RESET_REQUEST_TEMPLATE } from './emailTemplates.js';
import 'dotenv/config';


export const sendPasswordResetEmail = asyncHandler(async (to, username, resetCode) => {
    const updatedHtml = PASSWORD_RESET_REQUEST_TEMPLATE
        .replace('{username}', username)
        .replace('{resetCode}', resetCode);

    const mailOptions = {
        from: `TALABATAK ${process.env.Email_USER}`,
        to: to,
        subject: 'Password Reset Code (Valid for 1 hour)',
        html: updatedHtml,
        category: 'Password Reset'
    }
    transporter.sendMail(mailOptions);
   
});




export const sendEmail = async ({ to, subject, html }) => {

    await transporter.sendMail({
      from: `"TALABATAK" <${process.env.Email_USER}>`,
      to,
      subject,
      html,
    });
    
};
