import dotenv from "dotenv";

const nodeEnv = process.env.NODE_ENV || "development";
// Ensure .env values override any empty/old process env values.
dotenv.config({ path: `.env.${nodeEnv}`, override: true });
dotenv.config({ override: true });
