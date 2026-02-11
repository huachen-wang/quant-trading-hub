# API Debug Notes

## 关键发现
API服务器是可达的！访问 https://eaxau.com/api/trpc/strategies.list 返回了tRPC错误：
- "Invalid input: expected object, received undefined"
- code: -32600, BAD_REQUEST, httpStatus: 400

这说明：
1. API服务器正常运行
2. tRPC路由正常工作
3. 问题不是"服务器不可达"，而是请求参数格式不对

## 根本原因
API服务器完全正常！访问 https://eaxau.com/api/trpc/strategies.list?input={"json":{}} 返回了10条策略数据。

问题在于前端代码：
1. admin登录可能没有正确获取token
2. 或者admin-api.ts中的请求格式有问题
3. 需要检查前端代码是否已经部署到生产环境（web-build是否是最新的）
