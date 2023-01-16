import { PaymentResult } from './Payment'

export default class GatewayError extends Error {
	public paymentResult: PaymentResult

	constructor(message: string, paymentResult?: PaymentResult) {
		super(message)
		this.message = message
		this.paymentResult = paymentResult
	}
}
