import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
        secure: true,
        host: process.env.Email_HOST,
        port: process.env.Email_PORT,
        auth: {
            user: process.env.Email_USER,
            pass: process.env.Email_PASSWORD
        }
});

export default transporter;