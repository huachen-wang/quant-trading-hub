/**
 * 邮箱验证码的发放前置条件。
 *
 * 这些规则原先只写在 `auth.sendEmailCode` 里，`auth.sendVerificationCode`
 * 是同一功能的未加闸副本，导致未登录调用方可以为任意邮箱申领
 * `verify_email` / `bind_email` 验证码。判定抽到这里，两个 procedure 共用同一份，
 * 也让规则本身可以脱离数据库单测。
 *
 * 只判定"能不能发"，不发信、不落库。
 */

export type EmailCodePurpose =
  | "register"
  | "login"
  | "reset_password"
  | "bind_email"
  | "verify_email";

export type EmailCodeGateFacts = {
  purpose: EmailCodePurpose;
  /** 该邮箱在库里是否已有账号。只有 needsRegistrationLookup 为真时才需要查。 */
  emailIsRegistered?: boolean;
  /** 调用方当前是否已登录。 */
  requesterIsAuthenticated: boolean;
};

/**
 * ok 时带 deliver：是否真的发信。
 * 登录、找回密码这两种用途不再告诉调用方邮箱有没有注册（2026-10-17）：
 * 未注册也 ok，只是 deliver=false（不发信），对外回同一句话。
 */
export type EmailCodeGateResult = { ok: true; deliver: boolean } | { ok: false; error: string };

/** 这个用途的回复是否要对「邮箱有没有注册」保持一致（不能被拿来探测注册状态）。 */
export function hidesRegistrationStatus(purpose: EmailCodePurpose): boolean {
  return purpose === "login" || purpose === "reset_password";
}

/** 登录 / 找回密码发码的统一回复（注册与否、发没发信都一样）。 */
export const EMAIL_CODE_UNIFORM_MESSAGE = "如果这个邮箱已注册，验证码已发送";

/** 该 purpose 是否需要先查一次"邮箱是否已注册"。 */
export function needsRegistrationLookup(purpose: EmailCodePurpose): boolean {
  return purpose === "register" || purpose === "login" || purpose === "reset_password";
}

/** 该 purpose 是否要求调用方已登录。 */
export function needsAuthenticatedRequester(purpose: EmailCodePurpose): boolean {
  return purpose === "verify_email" || purpose === "bind_email";
}

export function checkEmailCodeRequest(facts: EmailCodeGateFacts): EmailCodeGateResult {
  const { purpose, emailIsRegistered, requesterIsAuthenticated } = facts;

  if (needsRegistrationLookup(purpose) && emailIsRegistered === undefined) {
    // 查库结果没传进来就直接拒绝：把"没查"当成"查过且通过"是这条闸最容易破的方式。
    return { ok: false, error: "无法确认邮箱状态，请稍后再试" };
  }

  if (purpose === "register" && emailIsRegistered) {
    return { ok: false, error: "该邮箱已注册，请直接登录" };
  }

  if (hidesRegistrationStatus(purpose)) {
    // 未注册：不报错、不发信，调用方照常回统一的那句话。
    return { ok: true, deliver: Boolean(emailIsRegistered) };
  }

  if (needsAuthenticatedRequester(purpose) && !requesterIsAuthenticated) {
    return { ok: false, error: "请先登录" };
  }

  return { ok: true, deliver: true };
}
