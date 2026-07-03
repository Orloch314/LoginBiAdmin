import tls from "tls";

function normalizeNewlines(value) {
  return String(value).replace(/\r?\n/g, "\r\n");
}

function base64(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

function buildMimeMessage({ fromName, fromEmail, toEmail, subject, textBody, htmlBody }) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return [
    `From: ${fromName} <${fromEmail}>`,
    `To: <${toEmail}>`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeNewlines(textBody).trim(),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeNewlines(htmlBody).trim(),
    "",
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.pending = [];
    this.responses = [];

    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
      this.consumeBuffer();
    });
    socket.on("error", (error) => {
      while (this.pending.length) {
        this.pending.shift().reject(error);
      }
    });
    socket.on("close", () => {
      const error = new Error("La connessione SMTP si è chiusa");
      while (this.pending.length) {
        this.pending.shift().reject(error);
      }
    });
  }

  consumeBuffer() {
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";

    let currentCode = null;
    let currentLines = [];

    for (const line of lines) {
      const match = line.match(/^(\d{3})([ -])(.*)$/);
      if (!match) {
        continue;
      }

      const [, code, separator, text] = match;
      if (!currentCode) {
        currentCode = code;
      }

      currentLines.push(text);
      if (separator === " ") {
        const response = { code: Number(currentCode), text: currentLines.join("\n") };
        if (this.pending.length) {
          this.pending.shift().resolve(response);
        } else {
          this.responses.push(response);
        }
        currentCode = null;
        currentLines = [];
      }
    }
  }

  nextResponse() {
    if (this.responses.length) {
      return Promise.resolve(this.responses.shift());
    }

    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  send(command) {
    this.socket.write(`${command}\r\n`);
  }

  async command(command) {
    this.send(command);
    return this.nextResponse();
  }

  end() {
    this.socket.end();
  }
}

function expectCode(response, expectedCodes, label) {
  const codes = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
  if (!codes.includes(response.code)) {
    throw new Error(`${label} fallito: ${response.code} ${response.text}`);
  }
}

export async function sendInviteEmail({
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPassword,
  fromName,
  fromEmail,
  toEmail,
  username,
  inviteLink
}) {
  const socket = tls.connect({
    host: smtpHost,
    port: smtpPort,
    servername: smtpHost,
    rejectUnauthorized: true
  });

  const session = new SmtpSession(socket);
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });

  try {
    expectCode(await session.nextResponse(), 220, "Greet");
    expectCode(await session.command(`EHLO ${smtpHost}`), 250, "EHLO");
    expectCode(await session.command("AUTH LOGIN"), 334, "AUTH LOGIN");
    expectCode(await session.command(base64(smtpUser)), 334, "AUTH username");
    expectCode(await session.command(base64(smtpPassword)), 235, "AUTH password");
    expectCode(await session.command(`MAIL FROM:<${fromEmail}>`), [250], "MAIL FROM");
    expectCode(await session.command(`RCPT TO:<${toEmail}>`), [250, 251], "RCPT TO");
    expectCode(await session.command("DATA"), 354, "DATA");

    const subject = "Portal BI";
    const textBody = `
Buenas

Hemos habilitado el portal para la visualización de los reportes BI

Portal: ${inviteLink}

Usuario: ${username}

Al primer ingreso pide cambiar, y automáticamente va a ver su/s reporte/s.

Saludos
    `;
    const htmlBody = `
<html>
  <body style="font-family: Arial, sans-serif; color: #222;">
    <p>Buenas</p>
    <p>Hemos habilitado el portal para la visualización de los reportes BI</p>
    <p>Portal: <a href="${inviteLink}">${inviteLink}</a></p>
    <p>Usuario: <strong>${username}</strong></p>
    <p>Al primer ingreso pide cambiar, y automáticamente va a ver su/s reporte/s.</p>
    <p>Saludos</p>
  </body>
</html>
    `;

    const message = buildMimeMessage({
      fromName,
      fromEmail,
      toEmail,
      subject,
      textBody,
      htmlBody
    });

    session.send(`${message}\r\n.`);
    expectCode(await session.nextResponse(), 250, "MAIL DATA");
    await session.command("QUIT");
    return { ok: true };
  } finally {
    session.end();
  }
}
