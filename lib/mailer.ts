import nodemailer, { type Transporter } from "nodemailer"

/**
 * SMTP transport, built once and reused. Nodemailer keeps a connection pool
 * per transport, so building one per email would open a fresh TLS handshake
 * to Google every time a register closes.
 *
 * Everything is read from the environment because the credentials must never
 * live in the repository - see .env.example for the keys.
 */
let transporter: Transporter | null = null

export const mailFrom = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || ""

/** Whether mail is configured at all. Callers skip sending when it is not. */
export const isMailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  )

const getTransporter = () => {
  if (transporter) return transporter

  const port = Number(process.env.SMTP_PORT || 587)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    pool: true,
    maxConnections: 2,
    // Closing a register waits on this send, so an unreachable mail server
    // must fail fast rather than hold the cashier at the screen. Nodemailer's
    // own defaults run to minutes.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  })
  return transporter
}

/** Comma/semicolon separated address list from an env var. */
export const recipientsFrom = (value?: string | null) =>
  (value || "")
    .split(/[,;]/)
    .map((address) => address.trim())
    .filter(Boolean)

export type MailInput = {
  to: string[]
  subject: string
  html: string
  text?: string
}

/**
 * Sends one message. Throws on failure - callers that must not break their
 * own transaction (closeRegisterSession) catch it themselves, so that the
 * decision of whether a failed email is fatal stays with the caller.
 */
export const sendMail = async ({ to, subject, html, text }: MailInput) => {
  if (!isMailConfigured())
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
    )
  if (!to.length) throw new Error("No recipients configured for this email.")

  const info = await getTransporter().sendMail({
    from: mailFrom(),
    to,
    subject,
    html,
    text,
  })
  return info.messageId
}
