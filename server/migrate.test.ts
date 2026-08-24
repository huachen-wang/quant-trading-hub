import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "./migrate";

describe("production database configuration", () => {
  it("fails closed instead of falling back to volatile mock storage", () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL must be configured in production",
    );
  });

  it("also treats Railway as production when NODE_ENV is absent", () => {
    expect(() =>
      resolveDatabaseUrl({
        NODE_ENV: "",
        RAILWAY_ENVIRONMENT_ID: "production-id",
      }),
    ).toThrow("DATABASE_URL must be configured in production");
  });

  it("allows mock storage only outside production", () => {
    expect(resolveDatabaseUrl({ NODE_ENV: "development" })).toBeNull();
  });
});
