export default class VerificationError extends Error {
	constructor(message: string) {
		super(message);
		this.message = message;
	}
}
