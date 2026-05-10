type RequiredEnvKey =
  | "JWT_SECRET"
  | "REFRESH_TOKEN_SECRET"
  | "ROOT_ENC_KEY_HEX"
  | "MYSQL_HOST"
  | "MYSQL_USER"
  | "MYSQL_DATABASE"
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_S3_BUCKET_UPLOADS"
  | "AWS_S3_BUCKET_PHOTOS"
  | "AWS_S3_BUCKET_RENDERS"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_WEBHOOK_SECRET"
  | "RESEND_API_KEY"
  | "RESEND_FROM_EMAIL";

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is not defined. Configure it in backend .env file.`);
  }
  return value;
}

function readNumberEnv(key: string, defaultValue: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive number.`);
  }
  return parsed;
}

function readOptionalEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export const env = {
  get nodeEnv() {
    return (process.env.NODE_ENV?.trim() ?? "development") as "development" | "production";
  },
  get port() {
    return readNumberEnv("PORT", 3005);
  },
  get corsOrigins(): string[] {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (!raw) return [];
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  },
  get jwtSecret() {
    return readRequiredEnv("JWT_SECRET");
  },
  get refreshTokenSecret() {
    return readRequiredEnv("REFRESH_TOKEN_SECRET");
  },
  get rootEncKeyHex() {
    return readRequiredEnv("ROOT_ENC_KEY_HEX");
  },
  get mysqlHost() {
    return readRequiredEnv("MYSQL_HOST");
  },
  get mysqlPort() {
    return readNumberEnv("MYSQL_PORT", 3306);
  },
  get mysqlUser() {
    return readRequiredEnv("MYSQL_USER");
  },
  get mysqlPassword() {
    return process.env.MYSQL_PASSWORD ?? "";
  },
  get mysqlDatabase() {
    return readRequiredEnv("MYSQL_DATABASE");
  },
  get mysqlConnectionLimit() {
    return readNumberEnv("MYSQL_CONNECTION_LIMIT", 10);
  },
  get awsRegion() {
    return process.env.AWS_REGION?.trim() ?? "eu-west-1";
  },
  get awsAccessKeyId() {
    return readRequiredEnv("AWS_ACCESS_KEY_ID");
  },
  get awsSecretAccessKey() {
    return readRequiredEnv("AWS_SECRET_ACCESS_KEY");
  },
  get awsS3BucketUploads() {
    return readRequiredEnv("AWS_S3_BUCKET_UPLOADS");
  },
  get awsS3BucketPhotos() {
    return readRequiredEnv("AWS_S3_BUCKET_PHOTOS");
  },
  get awsS3BucketRenders() {
    return readRequiredEnv("AWS_S3_BUCKET_RENDERS");
  },
  get stripeSecretKey() {
    return readRequiredEnv("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return readRequiredEnv("STRIPE_WEBHOOK_SECRET");
  },
  get stripePriceProMonthly() {
    return readOptionalEnv("STRIPE_PRICE_PRO_MONTHLY");
  },
  get stripePriceBusinessMonthly() {
    return readOptionalEnv("STRIPE_PRICE_BUSINESS_MONTHLY");
  },
  get resendApiKey() {
    return readRequiredEnv("RESEND_API_KEY");
  },
  get resendFromEmail() {
    return readRequiredEnv("RESEND_FROM_EMAIL");
  },
  get appUrl() {
    return process.env.APP_URL?.trim() ?? "http://localhost:5173";
  },
  get apiUrl() {
    return process.env.API_URL?.trim() ?? "http://localhost:3005";
  },
  get googleClientId() {
    return readOptionalEnv("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return readOptionalEnv("GOOGLE_CLIENT_SECRET");
  },
};
