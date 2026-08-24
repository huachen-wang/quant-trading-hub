export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NODE_ENV === "production" ||
    Boolean(
      env.RAILWAY_ENVIRONMENT_ID ||
        env.RAILWAY_ENVIRONMENT ||
        env.RAILWAY_PROJECT_ID ||
        env.RAILWAY_SERVICE_ID,
    )
  );
}
