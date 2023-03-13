import bunyan from 'bunyan';
import { assert } from 'chai';
import fs from 'fs';
import path from 'path';
import {
	CSOBPaymentModule,
	Currency,
	Language,
	PaymentMethod,
	PaymentOperation,
	PaymentStatus,
	ResultCode,
	ReturnMethod,
} from '../src';

const merchantId = process.env.MERCHANT_ID;
const keyName = `rsa_${merchantId}`;

const config = {
	gateUrl: 'https://iapi.iplatebnibrana.csob.cz/api/v1.8',
	privateKey: fs.readFileSync(
		path.join(
			__dirname,
			'cert',
			process.env.MERCHANT_KEY_NAME ?? `${keyName}.key`
		),
		'utf-8'
	),
	merchantPublicKey: fs.readFileSync(
		path.join(
			__dirname,
			'cert',
			process.env.MERCHANT_PUB_NAME ?? `${keyName}.pub`
		),
		'utf-8'
	),
	bankPublicKey: fs.readFileSync(
		path.join(__dirname, 'cert', 'mips_iplatebnibrana.csob.cz.pub'),
		'utf-8'
	),
	calbackUrl: 'http://localhost',
	merchantId: merchantId,
	payloadTemplate: {},
};
describe('CSOB payment gateway library', () => {
	const gateway = new CSOBPaymentModule({
		...{ logging: bunyan.createLogger({ name: 'test' }) },
		...config,
	});
	const orderId = '' + +new Date();
	const customerId = 'u' + orderId;
	let payId;

	it('should make echo POST', async () => {
		await gateway.echo('POST');
	});

	it('should make echo GET', async () => {
		await gateway.echo('GET');
	});

	it('init payment', async () => {
		const res = await gateway.init({
			customer: {
				account: customerId,
				email: 'test@test.cz',
				name: 'Tomáš Novák',
			},
			closePayment: false,
			currency: Currency.CZK,
			cart: [{ amount: 10, name: 'Test item', quantity: 1 }],
			language: Language.CS,
			orderNo: orderId,
			totalAmount: 10,
			customerId: customerId,
			order: {
				type: 'purchase',
				availability: 'now',
				delivery: 'digital',
				deliveryMode: 0,
			},
			payOperation: PaymentOperation.PAYMENT,
			payMethod: PaymentMethod.CARD,
			returnMethod: ReturnMethod.GET,
			returnUrl: 'http://localhost/order/' + orderId,
		});
		process.env.DEBUG && console.debug('init payment response', res);
		assert.equal(res.resultCode, ResultCode.OK);
		assert.isNotEmpty(res.payId);
		assert.isNotEmpty(res.signature);
		assert.isNotEmpty(res.dttm);
		payId = res.payId;
	});

	it('check payment - created status', async () => {
		const res = await gateway.status(payId);
		process.env.DEBUG && console.debug('init payment response', res);
		assert.equal(res.resultCode, ResultCode.OK);
		assert.equal(res.paymentStatus, PaymentStatus.CREATED);
		assert.equal(res.payId, payId);
		assert.isNotEmpty(res.signature);
		assert.isNotEmpty(res.dttm);

		process.env.DEBUG && console.debug('check payment - created status', res);
	});
});
