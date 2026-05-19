import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method: string; url: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} → ${status}: ${exception.message}`,
          exception.stack,
        );
      }
      response.status(status).json(exception.getResponse());
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `${request.method} ${request.url} → 500 UNHANDLED: ${err.message}`,
      err.stack,
    );
    response.status(500).json({
      statusCode: 500,
      message: "Internal server error",
      error: err.message,
    });
  }
}
