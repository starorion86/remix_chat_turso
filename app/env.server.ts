import * as dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
} as const;

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(
      `${key} is required. Please check your .env file or environment variables.`
    );
  }
}

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL!,
  DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN!,
} as const; 