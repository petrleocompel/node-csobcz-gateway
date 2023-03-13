import { Logger } from './Logger';

export interface Config {
	gateUrl: string;
	privateKey: string;
	merchantPublicKey: string;
	bankPublicKey: string;
	calbackUrl: string;
	merchantId: string;
	logger?: Logger | boolean;
	payloadTemplate?: object;
}
