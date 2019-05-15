/* global process */

import * as Logger from 'bunyan'
import * as crypto from 'crypto'
import * as superagent from 'superagent'

import {
  Currency,
  InitPayload,
  InputPayload,
  Language,
  OneClickPaymentInput,
  PaymentMethod,
  PaymentOperation,
  PaymentResult,
  PaymentStatus,
  ResultCode
} from './types/Payment'

import { Config } from './types/Config'
import GatewayError from './types/GatewayError'
import VerificationError from './types/VerificationError'
import moment from 'moment'

export { Currency, Language, ResultCode, PaymentStatus, GatewayError, VerificationError }
export class CSOBPaymentModule {
  private logger: Logger
  private config: Config

  constructor(config: Config) {
    this.logger = config.logger
    this.config = config

    this.config.payloadTemplate = {
      merchantId: this.config.merchantId,
      payMethod: 'card',
      returnUrl: this.config.calbackUrl,
      returnMethod: 'POST'
    }
  }

  async init(payload: InitPayload): Promise<PaymentResult> {
    try {
      payload['signature'] = this.sign(this.createPayloadMessage(payload))
      const result = await superagent
        .post(`${this.config.gateUrl}/payment/init`)
        .send(payload)
      if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
        if (result.body.resultCode.toString() === '0') {
          return result.body
        }

        this.logger.error({ result: result.body }, 'Payment failed')
        throw new GatewayError('Payment failed', result.body)
      } else {
        this.logger.error({ result: result.body }, 'Verification failed')
        throw new VerificationError('Verification failed')
      }
    } catch (err) {
      this.logger.error({ err }, 'Uknown error')
      throw err
    }
  }

  async oneClickPayment (input: OneClickPaymentInput): Promise<PaymentResult> {
    const payload = {
      merchantId: this.config.merchantId,
      origPayId: input.templatePaymentId,
      orderNo: input.orderNumber,
      dttm: this.createDttm(),
      totalAmount: input.amount,
      currency: input.currency
    }
    payload['signature'] = this.sign(this.createPayloadMessage(payload))
    let result
    try {
      result = await superagent
        .post(`${this.config.gateUrl}/payment/oneclick/init`)
        .send(payload)

      if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
        if (result.body.resultCode.toString() === '0') {
          const startPayload = {
            merchantId: this.config.merchantId,
            payId: result.body.payId,
            dttm: this.createDttm()
          }

          let startResult
          startPayload['signature'] = this.sign(this.createPayloadMessage(startPayload))
          startResult = await superagent
            .post(`${this.config.gateUrl}/payment/oneclick/start`)
            .send(startPayload)

          if (this.verify(this.createResultMessage(startResult.body), startResult.body.signature)) {
            if (startResult.body.resultCode.toString() === '0') {
              return startResult.body
            }
          } else {
            this.logger.error({ result: startResult.body }, 'Verification failed')
            throw new VerificationError('Verification failed')
          }

          this.logger.error({ result: startResult.body }, 'One click payment failed')
        }

        this.logger.error({ result: result.body }, 'One click payment failed')
        throw new GatewayError('Payment failed', result.body)
      } else {
        this.logger.error({ result: result.body }, 'Verification failed')
        throw new VerificationError('Verification failed')
      }
    } catch (err) {
      this.logger.error({ err }, 'Uknown error')
      throw new Error(err)
    }
  }

  public createPaymentPayload (payload: InputPayload, oneClick: boolean): any {
    return {
      ...this.config.payloadTemplate,
      dttm: this.createDttm(),
      payOperation: oneClick ? PaymentOperation.ONE_CLICK_PAYMENT : PaymentOperation.PAYMENT,
      payMethod: PaymentMethod.CARD,
      returnMethod: 'GET',
      closePayment: true,
      ...payload
    }
  }

  getRedirectUrl(id: string) {
    const dttm = this.createDttm()

    const signature = this.sign(`${this.config.merchantId}|${id}|${dttm}`)
    const url = `${this.config.gateUrl}/payment/process/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`

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

      this.logger.error({ result: result.body }, 'Status failed')
      throw new GatewayError('Status failed', result.body)
    }

    throw new VerificationError('Verification failed')
  }

  public async reverse(id: string): Promise<PaymentResult> {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this.createDttm()
    }

    payload['signature'] = this.sign(this.createPayloadMessage(payload))
    const result = await superagent
      .put(`${this.config.gateUrl}/payment/reverse`)
      .send(payload)

    if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
      if (result.body.resultCode.toString() === '0') {
        return result.body
      }

      throw new GatewayError('reverse failed', result.body)
    }

    throw new VerificationError('Verification failed')
  }

  public async close(id: string, amount: number): Promise<PaymentResult> {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this.createDttm(),
      amount
    }

    payload['signature'] = this.sign(this.createMessageString(payload))
    const result = await superagent
      .put(`${this.config.gateUrl}/payment/close`)
      .send(payload)

    if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
      if (result.body.resultCode.toString() === '0') {
        return result
      }

      throw new GatewayError('Close failed', result.body)
    }

    throw new VerificationError('Verification failed')
  }

  public async refund(id: string, amount: number) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this.createDttm(),
      amount
    }

    payload['signature'] = this.sign(this.createMessageString(payload))
    const result = superagent
      .put(`${this.config.gateUrl}/payment/refund`)
      .send(payload)

    if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
      if (result.body.resultCode.toString() === '0') {
        return result
      }

      throw new GatewayError('Refund failed', result.body)
    }

    throw new VerificationError('Verification failed')
  }

  public async echo(method = 'POST') {
    const payload = {
      merchantId: this.config.merchantId,
      dttm: this.createDttm(),
      signature: null
    }

    payload['signature'] = this.sign(this.createPayloadMessage(payload))
    let result
    try {
      if (method === 'POST') {
        result = await superagent
          .post(`${this.config.gateUrl}/echo`)
          .set('Content-Type', 'application/json')
          .send(payload)
      } else {
        result = await superagent
          .get(`${this.config.gateUrl}/echo/${payload.merchantId}/${payload.dttm}/${encodeURIComponent(payload.signature)}`)
          .send()
      }

      if (this.verify(this.createResultMessage(result.body), result.body.signature)) {
        if (result.body.resultCode.toString() === '0') {
          return result
        }

        throw new GatewayError('Echo failed', result.body)
      }
    } catch (err) {
      console.log(err)
    }

    throw new VerificationError('Verification failed')
  }

  public createPayloadMessage(payload) {

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

  public sign(text: string) {
    return crypto.createSign('sha1').update(text).sign(this.config.privateKey, 'base64')
  }

  private createDttm() {
    return moment().format('YYYYMMDDHHmmss')
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

  private createResultMessage(result) {
    const resultKeys = [
      'merchantId', 'payId', 'dttm', 'resultCode', 'resultMessage', 'paymentStatus', 'authCode', 'merchantData'
    ]
    return this.createMessageString(result, resultKeys)
  }
}
