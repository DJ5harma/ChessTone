export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(options: { statusCode: number; message: string }) {
        super(options.message);
        this.statusCode = options.statusCode;
        this.isOperational = true;

        Object.setPrototypeOf(this, AppError.prototype);
    }
}