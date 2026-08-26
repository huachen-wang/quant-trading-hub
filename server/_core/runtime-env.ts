type RuntimeEnvironment = {
  NODE_ENV?: string;
  RAILWAY_ENVIRONMENT_ID?: string;
  RAILWAY_ENVIRONMENT?: string;
  RAILWAY_PROJECT_ID?: string;
  RAILWAY_SERVICE_ID?: string;
};

export function isProductionRuntime(env: RuntimeEnvironment = process.env) {
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
