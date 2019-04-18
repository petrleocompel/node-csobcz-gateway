/* global process */

import * as Logger from 'bunyan'
import * as crypto from 'crypto'
import * as superagent from 'superagent'

import { Currency, InitPayload, InputPayload, Order, PaymentMethod, PaymentOperation } from './types/Order'

import { Config } from './types/Config'
import GatewayError from './types/GatewayError'
import moment from 'moment'

export { Currency }
export class CSOBPaymentModule {
  private logger: Logger
  private config: Config

  constructor(config: Config = {}) {
    this.logger = config.logging ? config.logging : {
      info: (args) => {
        console.log(args)
      }
    } as Logger

    this.config = {
      gateUrl: config.gateUrl || process.env.GATEWAY_URL,
      privateKey: config.privateKey || process.env.MERCHANT_PRIVATE_KEY,
      merchantPublicKey: config.merchantPublicKey || process.env.MERCHANT_PUBLIC_KEY,
      bankPublicKey: config.bankPublicKey || process.env.BANK_PUBLIC_KEY,
      calbackUrl: config.calbackUrl || process.env.CALLBACK_URL,
      merchantId: config.merchantId || process.env.MERCHANT_ID
    }

    this.config.payloadTemplate = {
      merchantId: this.config.merchantId,
      payOperation: 'payment',
      payMethod: 'card',
      currency: 'CZK',
      language: 'CZ',
      returnUrl: this.config.calbackUrl,
      returnMethod: 'POST'
    }
  }

  // init - 1. krok - inicializace platby
  async init(payload: InitPayload) {
    payload['signature'] = this.sign(this.createPayloadMessage(payload))
    const result = await superagent
      .post(`${this.config.gateUrl}/payment/init`)
      .send(payload)

    if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
      if (result.body.resultCode.toString() === '0') {
        return result.body
      }
      throw new GatewayError('init failed', result.body)

    }
    throw new Error('Init - Verification failed')
  }

  async oneClickPayment (payload: {}) {
    payload['signature'] = this.sign(this.createPayloadMessage(payload))
    let result
    try {
      result = await superagent
        .post(`${this.config.gateUrl}/payment/oneclick/init`)
        .send(payload)
    } catch (err) {
      console.log('oneclick failed', err)
    }

    if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
      if (result.body.resultCode.toString() === '0') {
        const startPayload = {
          merchantId: this.config.merchantId,
          payId: result.body.payId,
          dttm: this.createDttm()
        }

        let startResult
        try {
          startPayload['signature'] = this.sign(this.createPayloadMessage(startPayload))
          console.log('after')
          console.log('start call', startPayload)
          startResult = await superagent
            .post(`${this.config.gateUrl}/payment/oneclick/start`)
            .send(startPayload)
        } catch (err) {
          console.log('oneclick start failed', err)
        }

        if (this.verify(this.createResultMessage(startResult.body), startResult.body.signature)) {
          if (startResult.body.resultCode.toString() === '0') {
            return startResult.body
          }
        }
      }
      throw new GatewayError('init failed', result.body)

    }
    throw new Error('Init - Verification failed')
  }

  public createOneClickPaymentPayload (payload: InputPayload): any {
    return {
      ...this.config.payloadTemplate,
      dttm: this.createDttm(),
      payOperation: PaymentOperation.ONE_CLICK_PAYMENT,
      payMethod: PaymentMethod.CARD,
      returnMethod: 'GET',
      closePayment: true,
      ...payload
    }
  }

  // process - 2.krok - redirect url
  getRedirectUrl(id: string) {
    const dttm = this.createDttm()

    const signature = this.sign(`${this.config.merchantId}|${id}|${dttm}`)
    const url = `${this.config.gateUrl}/payment/process/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`
    this.logger.info('redirectUrl', url)
    return url
  }

  async status(id: string) {
    const dttm = this.createDttm()
    const signature = this.sign(`${this.config.merchantId}|${id}|${dttm}`)

    const url = `${this.config.gateUrl}/payment/status/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`
    const result = await superagent
      .get(url)
      .send()

    const message = this.createResultMessage(result.body)

    if (this.verify(message, result.body.signature)) {
      if (result.body.resultCode.toString() === '0') {
        return result.body
      }
      throw new GatewayError('status failed', result)

    }
    throw new Error('Status - Verification failed')
  }

  public async reverse(id: string) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this.createDttm()
    }

    payload['signature'] = this.sign(this.createMessageString(payload))
    this.logger.info('reverse', payload)
    const result = await superagent({
      url: `${this.config.gateUrl}/payment/reverse`,
      method: 'PUT',
      json: true,
      body: payload
    })
    if (this.verify(this.createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      }
      throw new GatewayError('reverse failed', result)

    }
    throw new Error('Reverse - Verification failed')

  }

  public async close(id: string, amount: number) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this.createDttm(),
      amount
    }

    payload['signature'] = this.sign(this.createMessageString(payload))
    this.logger.info('close', payload)
    const result = await superagent({
      url: `${this.config.gateUrl}/payment/close`,
      method: 'PUT',
      json: true,
      body: payload
    })
    if (this.verify(this.createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      }
      throw new GatewayError('close failed', result)

    }
    throw new Error('Close - Verification failed')

  }

  public async refund(id: string, amount: number) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this.createDttm(),
      amount
    }

    payload['signature'] = this.sign(this.createMessageString(payload))
    this.logger.info('refund', payload)
    const result = superagent({
      url: `${this.config.gateUrl}/payment/refund`,
      method: 'PUT',
      json: true,
      body: payload
    })
    if (this.verify(this.createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      }
      throw new GatewayError('refund failed', result)

    }
    throw new Error('Refund - Verification failed')
  }

  public async echo(method = 'POST') {
    const payload = {
      merchantId: this.config.merchantId,
      dttm: this.createDttm(),
      signature: null
    }

    payload['signature'] = this.sign(this.createMessageString(payload))
    this.logger.info('echo', payload)
    let result
    if (method === 'POST') {
      result = await superagent({
        url: `${this.config.gateUrl}/echo`,
        method: 'POST',
        json: true,
        body: payload
      })
    } else {
      result = await superagent({
        url: `${this.config.gateUrl}/echo/${payload.merchantId}/${payload.dttm}/${payload.signature}`,
        method: 'GET',
        json: true
      })
    }
    if (this.verify(this.createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      }
      throw new GatewayError('echo failed', result)

    }
    throw new Error('Echo - Verification failed')
  }

  public async verifyResult(result) {
    if (result.resultCode.toString() === '0') {
      if (this.verify(this.createResultMessage(result), result.signature)) {
        this.logger.info('verifyResult', result)
        result['merchantData'] = Buffer.from(result.merchantData, 'base64').toString('ascii')
        return result
      }
      throw new GatewayError('Verification failed')

    }
  }

  public createDttm() {
    return moment().format('YYYYMMDDHHmmss')
  }

  private sign(text: string) {
    return crypto.createSign('sha1').update(text).sign(this.config.privateKey, 'base64')
  }

  private verify(text: string, signature: string) {
    return crypto.createVerify('sha1').update(text).verify(this.config.bankPublicKey, signature, 'base64')
  }

  private createMessageArray(data, keys) {
    if (!keys) {
      keys = Object.keys(data)
    }
    return keys.map(key => data[key]).filter(item => typeof (item) !== 'undefined')
  }

  private createMessageString(data, keys = []) {
    return this.createMessageArray(data, keys).join('|')
  }

  private createPayloadMessage(payload) {

    const payloadKeys = [
      'merchantId', 'origPayId', 'orderNo', 'payId', 'dttm', 'payOperation', 'payMethod',
      'totalAmount', 'currency', 'closePayment', 'returnUrl', 'returnMethod'
    ]
    const cartItemKeys = [ 'name', 'quantity', 'amount', 'description' ]
    let payloadMessageArray = this.createMessageArray(payload, payloadKeys)
    if (payload.cart) {
      payload.cart.forEach(cartItem => {
        payloadMessageArray = payloadMessageArray.concat(this.createMessageArray(cartItem, cartItemKeys))
      })
    }

    payloadMessageArray = payloadMessageArray.concat(this.createMessageArray(payload, [
      'description', 'merchantData', 'customerId', 'language', 'ttlSec', 'logoVersion', 'colorSchemeVersion'
    ]))
    return payloadMessageArray.join('|')
  }

  private createResultMessage(result) {
    const resultKeys = [
      'payId', 'dttm', 'resultCode', 'resultMessage', 'paymentStatus', 'authCode', 'merchantData'
    ]
    return this.createMessageString(result, resultKeys)
  }
}
