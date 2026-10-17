const JSON_LD_ESCAPE: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * Serialize JSON-LD without allowing database text to close the script tag.
 * 放在 shared/：服务端预渲染和前端 <Head>（components/page-head.tsx）用同一个序列化，输出逐字相同。
 */
export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => JSON_LD_ESCAPE[character],
  );
}
