/**
 * 客户端侧的两条硬要求（对应独立复核 B2 / B3），用纯函数 + 源码断言各守一半。
 *
 * B2：聊天框上方永远不许出现 SQL 或客户正文。
 * B3：同一条草稿的重试必须复用同一个 clientMsgId。
 * 另外顺手守住「商品上下文要从联系弹窗传进咨询面板」，别在改版里悄悄丢了。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readableSupportError, SUPPORT_ERROR_TEXT } from "../lib/support-error-text";

const repoRoot = join(__dirname, "..");
const chatSource = readFileSync(join(repoRoot, "components", "support-chat.tsx"), "utf-8");
const modalSource = readFileSync(join(repoRoot, "components", "contact-modal.tsx"), "utf-8");

describe("B2 错误文案不泄露", () => {
  it("带 SQL 和客户正文的 500 消息不会被展示", () => {
    const leaked = {
      message:
        "Failed query: insert into `support_messages` (`conversationId`, `role`, `body`) values (?, ?, ?)\nparams: 15,customer,我的手机号是13800001111",
      data: { code: "INTERNAL_SERVER_ERROR" },
    };
    const text = readableSupportError(leaked);
    expect(text).toBe(SUPPORT_ERROR_TEXT.INTERNAL_SERVER_ERROR);
    expect(text).not.toContain("insert into");
    expect(text).not.toContain("13800001111");
    expect(text).not.toContain("support_messages");
  });

  it("即使错误码被标成 BAD_REQUEST，带 SQL 痕迹的文案照样不展示", () => {
    const disguised = {
      message: "Failed query: select `id` from `support_conversations` where ...",
      data: { code: "BAD_REQUEST" },
    };
    expect(readableSupportError(disguised)).toBe(SUPPORT_ERROR_TEXT.BAD_REQUEST);
  });

  it("超长的服务端文案不直接展示（防止把整段正文带出来）", () => {
    const long = { message: "客户说的话".repeat(50), data: { code: "BAD_REQUEST" } };
    expect(readableSupportError(long)).toBe(SUPPORT_ERROR_TEXT.BAD_REQUEST);
  });

  it("我们自己写的短提示可以原样展示", () => {
    expect(
      readableSupportError({ message: "发送太频繁了，稍等一下再试", data: { code: "TOO_MANY_REQUESTS" } }),
    ).toBe("发送太频繁了，稍等一下再试");
  });

  it("没有错误码 / 空错误也有兜底文案，不会渲染 undefined", () => {
    expect(readableSupportError(null)).toBe(SUPPORT_ERROR_TEXT.INTERNAL_SERVER_ERROR);
    expect(readableSupportError({})).toBe(SUPPORT_ERROR_TEXT.INTERNAL_SERVER_ERROR);
    expect(readableSupportError({ message: "随便什么" })).toBe(
      SUPPORT_ERROR_TEXT.INTERNAL_SERVER_ERROR,
    );
  });

  it("聊天面板不再直接展示服务端 message", () => {
    expect(chatSource).not.toMatch(/setError\(\s*err\??\.\s*message/);
    expect(chatSource).toContain("readableSupportError");
  });
});

describe("B3 幂等键在重试时复用", () => {
  it("发送路径用的是 ref 里的 clientMsgId，不是每次现生成", () => {
    // 只允许在「ref 为空时」生成一次
    expect(chatSource).toContain("if (!pendingClientMsgId.current) pendingClientMsgId.current = newClientMsgId();");
    // mutate 调用里传的必须是那个变量，而不是 newClientMsgId() 的即时调用
    expect(chatSource).not.toMatch(/clientMsgId:\s*newClientMsgId\(\)/);
  });

  it("只有成功之后才作废幂等键（失败要保留，才能重试同一条）", () => {
    const successBlock = chatSource.slice(chatSource.indexOf("pendingClientMsgId.current = null"));
    expect(successBlock).toContain("setDraft(\"\")");
    // catch 分支里不许清空幂等键或草稿
    // handleSend 里有内外两层 catch（内层是 CONFLICT 换令牌重试），要看的是**最外层**那个。
    const handleSendBlock = chatSource.slice(
      chatSource.indexOf("const handleSend"),
      chatSource.indexOf("const handleClaim"),
    );
    const catchBlock = handleSendBlock.slice(handleSendBlock.lastIndexOf("} catch (err: any) {"));
    expect(catchBlock).not.toContain("pendingClientMsgId.current = null");
    expect(catchBlock).not.toContain("setDraft(\"\")");
  });

  it("后台回复同样带幂等键", () => {
    const adminSource = readFileSync(join(repoRoot, "app", "admin", "support.tsx"), "utf-8");
    expect(adminSource).toContain("clientMsgId: pendingReplyId.current");
  });
});

describe("商品上下文不能在改版里丢掉", () => {
  it("联系弹窗把商品编号 / 标题 / 页面地址传进咨询面板", () => {
    const usage = modalSource.slice(modalSource.indexOf("<SupportChat"));
    expect(usage).toContain("strategyId=");
    expect(usage).toContain("strategyTitle={context?.productTitle");
    expect(usage).toContain("pageUrl={context?.pageUrl");
  });

  it("咨询面板把上下文交给服务端，服务端再自己查库核对标题", () => {
    expect(chatSource).toContain("strategyId: strategyId ?? null");
    const serviceSource = readFileSync(
      join(repoRoot, "server", "support", "service.ts"),
      "utf-8",
    );
    // 标题只认库里的值，不回落到客户端传来的字符串
    expect(serviceSource).toContain("db.getStrategyById");
    expect(serviceSource).not.toContain("strategyTitle: input.strategyTitle");
  });
});
