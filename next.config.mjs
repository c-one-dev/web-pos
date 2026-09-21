/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nodemailer is a Node library with dynamic requires; bundling it breaks
  // the SMTP transport, so it is loaded from node_modules at runtime.
  serverExternalPackages: ["nodemailer"],
  allowedDevOrigins: ["192.168.1.56", "11.11.11.51", "172.24.80.1", "192.168.6.56", "192.168.1.237", "172.20.48.1", "192.168.112.1", "172.25.224.1", "11.11.11.37", "192.168.240.1", "192.168.1.4", "192.168.6.138", "192.168.1.65", "192.168.1.25", "192.168.1.3", "192.168.1.73", "192.168.1.28"],
}

export default nextConfig
