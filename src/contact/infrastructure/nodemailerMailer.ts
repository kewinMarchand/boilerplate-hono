import { createTransport } from 'nodemailer'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'
import type { Transporter } from 'nodemailer'

/** Le visiteur attend la réponse pendant l'envoi : un serveur SMTP muet ne la retient pas deux minutes (défaut de nodemailer). */
const TIMEOUT_MS = 5000

/** Transport SMTP de `MAILER_DSN` (smtp:// ou smtps://, identifiants compris). */
export const smtpTransport = (dsn: string): Transporter =>
  createTransport({
    url: dsn,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  })

/** Envoi en texte brut, expéditeur `MAILER_FROM`. Les tests passent le transport en flux de nodemailer. */
export const nodemailerMailer = (
  transport: Pick<Transporter, 'sendMail'>,
  from: string,
): ContactMessage.Mailer => ({
  send: async ({ to, replyTo, subject, text }) => {
    await transport.sendMail({ from, to, replyTo, subject, text })
  },
})
