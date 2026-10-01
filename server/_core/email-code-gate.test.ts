import { describe, expect, it } from "vitest";
import {
  checkEmailCodeRequest,
  needsAuthenticatedRequester,
  needsRegistrationLookup,
  type EmailCodePurpose,
} from "./email-code-gate";

describe("email verification code gate", () => {
  it("blocks register when the email already has an account", () => {
    expect(
      checkEmailCodeRequest({
        purpose: "register",
        emailIsRegistered: true,
        requesterIsAuthenticated: false,
      }),
    ).toEqual({ ok: false, error: "该邮箱已注册，请直接登录" });
  });

  it("allows register for an unused email", () => {
    expect(
      checkEmailCodeRequest({
        purpose: "register",
        emailIsRegistered: false,
        requesterIsAuthenticated: false,
      }),
    ).toEqual({ ok: true });
  });

  it.each(["login", "reset_password"] as const)(
    "blocks %s for an email with no account",
    (purpose) => {
      expect(
        checkEmailCodeRequest({
          purpose,
          emailIsRegistered: false,
          requesterIsAuthenticated: false,
        }),
      ).toEqual({ ok: false, error: "该邮箱未注册" });
    },
  );

  it.each(["verify_email", "bind_email"] as const)(
    "blocks %s for an anonymous requester",
    (purpose) => {
      expect(
        checkEmailCodeRequest({ purpose, requesterIsAuthenticated: false }),
      ).toEqual({ ok: false, error: "请先登录" });
    },
  );

  it.each(["verify_email", "bind_email"] as const)(
    "allows %s once the requester is signed in",
    (purpose) => {
      expect(
        checkEmailCodeRequest({ purpose, requesterIsAuthenticated: true }),
      ).toEqual({ ok: true });
    },
  );

  it("refuses to decide when a required registration lookup was skipped", () => {
    for (const purpose of ["register", "login", "reset_password"] as const) {
      expect(
        checkEmailCodeRequest({ purpose, requesterIsAuthenticated: false }),
      ).toEqual({ ok: false, error: "无法确认邮箱状态，请稍后再试" });
    }
  });

  it("declares which facts each purpose needs", () => {
    const purposes: EmailCodePurpose[] = [
      "register",
      "login",
      "reset_password",
      "verify_email",
      "bind_email",
    ];
    expect(purposes.filter(needsRegistrationLookup)).toEqual([
      "register",
      "login",
      "reset_password",
    ]);
    expect(purposes.filter(needsAuthenticatedRequester)).toEqual([
      "verify_email",
      "bind_email",
    ]);
  });
});
