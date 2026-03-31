export class HuiYunYingHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly detail: string = ""
  ) {
    super(message);
    this.name = "HuiYunYingHttpError";
  }
}
