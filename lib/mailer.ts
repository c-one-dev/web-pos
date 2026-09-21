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

const SMTP_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const

/**
 * How the mail settings stand.
 *
 * "off" means nothing at all is set, which is a deliberate choice: an
 * installation that does not want the emails simply leaves them out.
 * "incomplete" means some keys are filled and others are not - that is
 * somebody half way through setting it up, and it must be reported rather
 * than treated as "off", because it looks exactly like a working install
 * from the outside while sending nothing.
 */
export const mailConfigStatus = () => {
  const missing = SMTP_KEYS.filter((key) => !process.env[key]?.trim())
  if (missing.length === SMTP_KEYS.length) return { state: "off" as const }
  if (missing.length) return { state: "incomplete" as const, missing }
  return { state: "ready" as const }
}

/** Whether mail can actually be sent. */
export const isMailConfigured = () => mailConfigStatus().state === "ready"

/**
 * Google prints an App Password in four blocks of four ("abcd efgh ijkl
 * mnop") to make it readable, but its SMTP server compares the string
 * literally and rejects the spaces with 535 BadCredentials. An App Password
 * never contains whitespace, so removing it is always safe and saves an hour
 * of chasing a credential that was correct all along.
 */
const credential = (value?: string) => (value || "").replace(/\s+/g, "")

const getTransporter = () => {
  if (transporter) return transporter

  const port = Number(process.env.SMTP_PORT || 587)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port,
    // 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: credential(process.env.SMTP_PASSWORD),
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

/**
 * Opens a connection and authenticates, without sending anything. Used by
 * scripts/test-closure-email.ts --verify to check credentials in a couple of
 * seconds rather than by sending a whole report.
 */
export const verifyMail = async () => {
  if (!isMailConfigured())
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
    )
  await getTransporter().verify()
  return true
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
