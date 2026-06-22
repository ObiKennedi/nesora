// lib/mail.ts
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = "NESORA <noreply@nesora.org>"

export async function sendVerificationEmail(email: string, token: string) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`
    await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Verify your NESORA email",
        html: `
            <p>Welcome to NESORA.</p>
            <p>Click the link below to verify your email address. It expires in 24 hours.</p>
            <a href="${url}">${url}</a>
        `,
    })
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
    await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Reset your NESORA password",
        html: `
            <p>You requested a password reset.</p>
            <p>Click the link below. It expires in 1 hour.</p>
            <a href="${url}">${url}</a>
            <p>If you didn't request this, ignore this email.</p>
        `,
    })
}