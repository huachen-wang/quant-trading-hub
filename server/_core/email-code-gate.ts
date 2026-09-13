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

export type EmailCodeGateResult = { ok: true } | { ok: false; error: string };

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

  if ((purpose === "reset_password" || purpose === "login") && !emailIsRegistered) {
    return { ok: false, error: "该邮箱未注册" };
  }

  if (needsAuthenticatedRequester(purpose) && !requesterIsAuthenticated) {
    return { ok: false, error: "请先登录" };
  }

  return { ok: true };
}
