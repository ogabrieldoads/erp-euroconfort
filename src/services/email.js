const { Resend } = require("resend");

let resendClient = null;

function resend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function appUrl() {
  return String(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function conviteHtml({ nome, papel, loja, token }) {
  const linkAtivacao = `${appUrl()}/ativar-conta?token=${encodeURIComponent(token)}`;
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-top: 0;">Bem-vindo à equipe Euroconfort</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">
        Olá, <strong>${escapeHtml(nome)}</strong>! Você foi convidado para integrar o sistema ERP com o perfil de <strong>${escapeHtml(papel)}</strong> na unidade <strong>${escapeHtml(loja)}</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${linkAtivacao}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Definir Senha e Ativar Conta
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">
        Este link expira em 48 horas. Se o botão acima não funcionar, acesse: <br/>
        <a href="${linkAtivacao}" style="color: #2563eb;">${linkAtivacao}</a>
      </p>
    </div>
  `;
}

async function enviarEmailConvite({ nome, email, papel, loja, token }) {
  const client = resend();
  if (!client) {
    return { sent: false, reason: "RESEND_API_KEY não configurada." };
  }
  const result = await client.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to: email,
    subject: "Convite para a equipe Euroconfort - Ativação de Acesso",
    html: conviteHtml({ nome, papel, loja, token })
  });
  return { sent: true, id: result?.data?.id || result?.id || null };
}

module.exports = { enviarEmailConvite };
