import { createTransport } from 'nodemailer'
import { describe, expect, it } from 'vitest'

import { nodemailerMailer } from '#/contact/infrastructure/nodemailerMailer.ts'

describe('nodemailerMailer', () => {
  it('envoie en texte brut, de MAILER_FROM, avec la réponse au visiteur', async () => {
    const transport = createTransport({ streamTransport: true, buffer: true })
    const sent: string[] = []
    const mailer = nodemailerMailer(
      {
        sendMail: async (options) => {
          const info = await transport.sendMail(options)
          sent.push(Buffer.isBuffer(info.message) ? info.message.toString() : '')
          return info
        },
      },
      'site@example.com',
    )
    await mailer.send({
      to: 'contact@example.com',
      replyTo: 'camille@example.fr',
      subject: 'Demande de renseignement : Monstera deliciosa',
      text: 'Nom : Camille\n',
    })

    const [raw = ''] = sent
    expect(raw).toContain('From: site@example.com')
    expect(raw).toContain('To: contact@example.com')
    expect(raw).toContain('Reply-To: camille@example.fr')
    expect(raw).toContain('Subject: Demande de renseignement : Monstera deliciosa')
    expect(raw).toContain('Content-Type: text/plain')
    expect(raw).not.toContain('text/html')
  })
})
