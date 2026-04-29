export const ENV = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    PORT: parseInt(process.env.PORT || "4000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-in-production",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
};