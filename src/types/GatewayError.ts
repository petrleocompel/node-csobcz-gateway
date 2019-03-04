class GatewayError extends Error {
  private meta: Object

  constructor(message: string, meta?: Object) {
    super(message)
    this.message = message
    this.meta = meta
  }
}
