import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV || "development";

// Load .env files WITHOUT override so that system environment variables
// (set via webdev_request_secrets / Railway / deployment platform) take priority.
// Order: .env.{NODE_ENV} first (lower priority), then .env (higher priority among files).
// System env vars always win since override is false.
dotenv.config({ path: `.env.${nodeEnv}` });
dotenv.config();
