/**
 * 客户端侧的两条硬要求（对应独立复核 B2 / B3），用纯函数 + 源码断言各守一半。
 *
 * B2：聊天框上方永远不许出现 SQL 或客户正文。
 * B3 / P2：同一条草稿的重试复用同一个 clientMsgId；**草稿改了就必须换新键**，
 *   并且界面要明说上一次那条可能已经落库——绝不能用旧键把新正文吞掉还报成功。
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

describe("B3 / P2 幂等键与草稿内容绑在一起", () => {
  it("幂等键和当时的正文存在同一个 ref 里，不是只存一个键", () => {
    expect(chatSource).toContain(
      "const pendingAttempt = useRef<{ clientMsgId: string; body: string } | null>(null);",
    );
    // 发出去的是这次尝试记下的正文，不是当前草稿——键和正文必须对得上
    expect(chatSource).toContain("body: sending.body,");
    expect(chatSource).not.toMatch(/clientMsgId:\s*newClientMsgId\(\)\s*,\s*\n\s*body:/);
  });

  it("正文变了就换新键，并把上一次标成待确认（不能用旧键吞新正文）", () => {
    const block = chatSource.slice(
      chatSource.indexOf("let attempt = pendingAttempt.current;"),
      chatSource.indexOf("const submit = async"),
    );
    expect(block).toContain("attempt.body !== typed");
    expect(block).toContain("setUnresolvedAttempt");
    expect(block).toContain("attempt = null;");
    expect(block).toContain("newClientMsgId()");
  });

  it("待确认那条是用它自己的 clientMsgId 去线程里核对，不靠正文猜", () => {
    expect(chatSource).toContain("message.clientMsgId === unresolvedAttempt.clientMsgId");
    // 服务端把客户自己的幂等键回传了，才核对得了
    const contracts = readFileSync(
      join(repoRoot, "shared", "support", "contracts.ts"),
      "utf-8",
    );
    expect(contracts).toContain("clientMsgId: string | null;");
    const serviceSource = readFileSync(join(repoRoot, "server", "support", "service.ts"), "utf-8");
    expect(serviceSource).toContain('row.role === "customer" ? row.clientMsgId : null');
  });

  it("界面上必须明说上一条可能已经发出去，并给重发原文的出口", () => {
    expect(chatSource).toContain("我们还没确认它有没有送到");
    expect(chatSource).toContain("重发原来那条");
    expect(chatSource).toContain("handleResendUnresolved");
    // 重发原文走的是原来的键
    const resend = chatSource.slice(chatSource.indexOf("const handleResendUnresolved"));
    expect(resend).toContain("clientMsgId: unresolvedAttempt.clientMsgId");
    expect(resend).toContain("body: unresolvedAttempt.body");
  });

  it("只有成功之后才作废这次尝试（失败要保留，才能重试同一条）", () => {
    const handleSendBlock = chatSource.slice(
      chatSource.indexOf("const handleSend"),
      chatSource.indexOf("const handleResendUnresolved"),
    );
    const catchBlock = handleSendBlock.slice(handleSendBlock.lastIndexOf("} catch (err: any) {"));
    expect(catchBlock).not.toContain("pendingAttempt.current = null");
    expect(catchBlock).not.toContain("setDraft(");
  });

  it("清空草稿前先确认草稿还是这次发出去的那份（飞行期间改的字不能被抹掉）", () => {
    expect(chatSource).toContain(
      'setDraft((current) => (current.trim() === sending.body ? "" : current));',
    );
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
