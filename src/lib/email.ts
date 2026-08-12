interface EmailRuntimeEnv {
  EMAIL?: SendEmail;
  AUTH_EMAIL_FROM?: string;
  SUPPORT_NOTIFICATION_EMAIL?: string;
}

export interface LifeQuizEmailSender {
  sendVerification(input: { to: string; name: string; url: string }): Promise<void>;
  sendPasswordReset(input: { to: string; name: string; url: string }): Promise<void>;
  sendSupportAlert(input: {
    ticketCode: string;
    name: string;
    email: string;
    categoryLabel: string;
    subject: string;
    message: string;
  }): Promise<"sent" | "pending">;
}

export function createLifeQuizEmailSender(runtimeEnv: unknown): LifeQuizEmailSender | null {
  const env = runtimeEnv as EmailRuntimeEnv;
  const binding = env.EMAIL;
  const from = env.AUTH_EMAIL_FROM?.trim();
  if (!binding || !isEmail(from)) return null;

  const sender = { name: "라이프퀴즈", email: from };
  return {
    async sendVerification({ to, name, url }) {
      await binding.send({
        from: sender,
        to,
        subject: "[라이프퀴즈] 이메일을 확인해주세요",
        text: `${name}님, 아래 주소에서 이메일 확인을 완료해주세요.\n\n${url}\n\n요청하지 않았다면 이 메일을 무시해주세요.`,
        html: emailFrame(
          "이메일 확인",
          `${name}님, 학습 계정의 이메일을 확인해주세요.`,
          "이메일 확인하기",
          url,
        ),
      });
    },
    async sendPasswordReset({ to, name, url }) {
      await binding.send({
        from: sender,
        to,
        subject: "[라이프퀴즈] 비밀번호 재설정",
        text: `${name}님, 아래 주소에서 새 비밀번호를 설정해주세요. 링크는 1시간 동안 유효합니다.\n\n${url}\n\n요청하지 않았다면 이 메일을 무시해주세요.`,
        html: emailFrame(
          "비밀번호 재설정",
          `${name}님, 링크는 1시간 동안 유효합니다.`,
          "새 비밀번호 설정하기",
          url,
        ),
      });
    },
    async sendSupportAlert(input) {
      const recipient = env.SUPPORT_NOTIFICATION_EMAIL?.trim();
      if (!isEmail(recipient)) return "pending";
      const subject = `[Life Quiz ${input.ticketCode}] ${input.subject.replace(/[\r\n]+/g, " ")}`;
      const text = [
        `접수번호: ${input.ticketCode}`,
        `분류: ${input.categoryLabel}`,
        `신청자: ${input.name} <${input.email}>`,
        `제목: ${input.subject}`,
        "",
        input.message,
        "",
        "운영 문의함: https://life-quiz.life-quiz.workers.dev/admin",
      ].join("\n");
      await binding.send({
        from: sender,
        to: recipient,
        replyTo: input.email,
        subject,
        text,
        html: emailFrame(
          `${input.ticketCode} 새 문의`,
          `<strong>${escapeHtml(input.categoryLabel)}</strong><br>${escapeHtml(input.name)} · ${escapeHtml(input.email)}<br><br>${escapeHtml(input.message).replace(/\n/g, "<br>")}`,
          "운영 문의함 열기",
          "https://life-quiz.life-quiz.workers.dev/admin",
          true,
        ),
      });
      return "sent";
    },
  };
}

function emailFrame(title: string, message: string, action: string, url: string, trustedMessageHtml = false) {
  const safeMessage = trustedMessageHtml ? message : escapeHtml(message);
  const safeUrl = escapeHtml(url);
  return `<!doctype html><html lang="ko"><body style="margin:0;background:#f4f7f5;color:#17201c;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="font-size:24px">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.7">${safeMessage}</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#177858;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">${escapeHtml(action)}</a></p><p style="font-size:12px;line-height:1.6;color:#66736d;word-break:break-all">버튼이 열리지 않으면 다음 주소를 이용해주세요.<br>${safeUrl}</p></div></body></html>`;
}

function isEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
