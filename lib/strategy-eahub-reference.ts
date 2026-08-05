export type StrategyEahubReference = {
  name: string;
  url: string;
  summary: string;
};

const EAHUB_REFERENCES: ReadonlyArray<{
  pattern: RegExp;
  reference: StrategyEahubReference;
}> = [
  {
    pattern: /金戈铁马/i,
    reference: {
      name: "EAHub 金戈铁马同名版本资料",
      url: "https://www.eahub.cn/thread-201119-1-1.html",
      summary:
        "公开资料将同名版本描述为 XAUUSD 多核对冲系统，涉及分层持仓、均价管理与移动退出，更偏向震荡和假突破回归场景。",
    },
  },
  {
    pattern: /quantum\s*queen|量子女王|量子女皇/i,
    reference: {
      name: "EAHub Quantum Queen 同名版本资料",
      url: "https://www.eahub.cn/thread-180114-1-1.html",
      summary:
        "公开资料提到同名版本面向 XAUUSD，组合多套内部策略并提供 M1、M15 等运行周期；不同流通版本的平台和参数需要单独确认。",
    },
  },
  {
    pattern: /gold\s*house|黄金屋/i,
    reference: {
      name: "EAHub Gold House 同名版本资料",
      url: "https://www.eahub.cn/thread-191895-1-1.html",
      summary:
        "公开资料将其定位为黄金高低点突破系统，并提到止损、止盈和追踪距离会随价格结构调整，重点依赖趋势延续与波动释放。",
    },
  },
  {
    pattern: /金麒麟/i,
    reference: {
      name: "EAHub 金麒麟同名版本资料",
      url: "https://www.eahub.cn/thread-199938-1-1.html",
      summary:
        "公开资料描述的同名版本结合趋势判断、网格布局、挂单跟随与分批止盈，并通过多周期状态识别调整交易方向和节奏。",
    },
  },
  {
    pattern: /gold\s*snap/i,
    reference: {
      name: "EAHub Gold Snap 同名版本资料",
      url: "https://www.eahub.cn/thread-200096-1-1.html",
      summary:
        "公开资料将其描述为 Gold House 的短节奏分支，更关注快速捕捉较短行情，运行时需重点核对黄金点差、执行速度与 VPS 环境。",
    },
  },
  {
    pattern: /sharkyra/i,
    reference: {
      name: "EAHub Sharkyra Gold 同名版本资料",
      url: "https://www.eahub.cn/thread-193936-1-1.html",
      summary:
        "公开资料显示同名版本主要运行于 XAUUSD M5，并以多周期趋势分析辅助短线执行，对低点差、成交速度和持续在线环境较敏感。",
    },
  },
  {
    pattern: /the\s*gold\s*reaper|黄金收割/i,
    reference: {
      name: "EAHub The Gold Reaper 同名版本资料",
      url: "https://www.eahub.cn/thread-186932-1-1.html",
      summary:
        "公开资料将其归为黄金多周期突破策略，通过支撑阻力确认寻找入场，并按账户规模和允许回撤调整交易频率及下单规模。",
    },
  },
  {
    pattern: /twister\s*pro/i,
    reference: {
      name: "EAHub TwisterPro 同名版本资料",
      url: "https://www.eahub.cn/thread-191100-1-1.html",
      summary:
        "公开资料把同名版本定位为 XAUUSD M15 短线系统，入场需经过多层条件确认，并提供不同交易频率和追踪退出模式。",
    },
  },
  {
    pattern: /quantum\s*athena|量子雅典娜/i,
    reference: {
      name: "EAHub Quantum Athena 同名版本资料",
      url: "https://www.eahub.cn/thread-191891-1-1.html",
      summary:
        "公开资料将其描述为专注黄金的精简型多策略引擎，强调减少不必要的复杂度，并以多套内部逻辑适配当前波动结构。",
    },
  },
  {
    pattern: /quantum\s*emperor|量子皇帝/i,
    reference: {
      name: "EAHub Quantum Emperor 同名版本资料",
      url: "https://www.eahub.cn/thread-113889-1-1.html",
      summary:
        "公开资料提到同名版本会把单次交易拆分为多个较小仓位，并通过后续盈利逐步处理亏损持仓；品种、时区与风险参数需按版本核对。",
    },
  },
  {
    pattern: /artquant\s*gold/i,
    reference: {
      name: "EAHub ArtQuant Gold 同名版本资料",
      url: "https://www.eahub.cn/thread-201599-1-1.html",
      summary:
        "公开资料显示同名版本采用黄金多模块架构，集中管理组合敞口、执行过滤、虚拟止盈止损和账户保护，并支持经纪商黄金代码变体。",
    },
  },
  {
    pattern: /smart\s*owl/i,
    reference: {
      name: "EAHub Smart Owl FX 同名版本资料",
      url: "https://www.eahub.cn/thread-191234-1-1.html",
      summary:
        "公开资料将其定位为亚洲时段的多货币短线算法，通过同时观察多个交叉盘寻找入场，对低点差账户和执行环境要求较高。",
    },
  },
  {
    pattern: /(^|\s)lizard(\s|$)/i,
    reference: {
      name: "EAHub Lizard 同名版本资料",
      url: "https://www.eahub.cn/thread-200486-1-1.html",
      summary:
        "公开条目给出的同名版本基础配置为 XAUUSD H1，但策略细节和验证周期披露较少，仍需结合实际文件与参数进一步确认。",
    },
  },
  {
    pattern: /axio\s*gold/i,
    reference: {
      name: "EAHub AXIO Gold 同名版本资料",
      url: "https://www.eahub.cn/thread-191099-1-1.html",
      summary:
        "公开资料提到同名版本通过自适应逻辑与市场环境过滤评估黄金短线机会，部分实时条件未必能在历史测试中完整复现。",
    },
  },
];

export function resolveStrategyEahubReference(title: string) {
  const normalized = title.normalize("NFKC").trim();
  return EAHUB_REFERENCES.find(({ pattern }) => pattern.test(normalized))
    ?.reference;
}
