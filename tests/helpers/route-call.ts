/** 不监听端口：直接调用已注册的真实路由处理器。解析器/网络传输不在这个替身的验证范围内。 */
export function routeHarness() {
  const routes = new Map<string, Function>();
  const app: any = {};
  for (const method of ["get", "post", "patch"]) {
    app[method] = (path: string, ...handlers: Function[]) => routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1)!);
  }
  return {
    app,
    async call(method: string, path: string, body: unknown = {}, inputHeaders: Record<string, string> = {}) {
      const url = new URL(path, "https://example.test");
      const headers = Object.fromEntries(Object.entries(inputHeaders).map(([name, value]) => [name.toLowerCase(), value]));
      const req: any = {
        method, body, query: Object.fromEntries(url.searchParams), headers,
        protocol: "https", hostname: "example.test", socket: {},
        is: (type: string) => headers["content-type"]?.split(";")[0] === type ? type : false,
      };
      let status = 200;
      let output: any;
      const responseHeaders = new Headers();
      const res: any = {
        status(code: number) { status = code; return res; },
        json(value: any) { output = value; return res; },
        send(value: any) { output = value; return res; },
        setHeader(name: string, value: string) { responseHeaders.set(name, value); return res; },
        cookie(name: string, value: string) { responseHeaders.append("Set-Cookie", `${name}=${encodeURIComponent(value)}`); return res; },
        clearCookie(name: string) { responseHeaders.append("Set-Cookie", `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT`); return res; },
      };
      const handler = routes.get(`${method} ${url.pathname}`);
      if (!handler) throw new Error(`No fixture route ${method} ${url.pathname}`);
      await handler(req, res);
      return { status, headers: responseHeaders, json: async () => output, text: async () => typeof output === "string" ? output : JSON.stringify(output) };
    },
  };
}
