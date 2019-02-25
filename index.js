/* global process */

import * as crypto from 'crypto'
import { Config } from './src/types/Config'
import * as request from 'superagent'

export class CSOBPaymentModule {
  private logger: any
  private config: Config

  constructor(config: Config = {}) {
    this.logger = config.logging ?
      typeof (config.logging) === 'function' ?
        config.logging : console.log : () => {
      }

    this.config = {
      gateUrl: config.gateUrl || process.env.GATEWAY_URL,
      privateKey: config.privateKey || process.env.MERCHANT_PRIVATE_KEY,
      merchantPublicKey: config.merchantPublicKey || process.env.MERCHANT_PUBLIC_KEY,
      bankPublicKey: config.bankPublicKey || process.env.BANK_PUBLIC_KEY,
      calbackUrl: config.calbackUrl || process.env.CALLBACK_URL,
      merchantId: config.merchantId || process.env.MERCHANT_ID
    }

    this.config.payloadTemplate = {
      "merchantId": this.config.merchantId,
      "payOperation": "payment",
      "payMethod": "card",
      "currency": "CZK",
      "language": "CZ",
      "returnUrl": this.config.calbackUrl,
      "returnMethod": "POST"
    }
  }

  _prefixNumber(number) {
    return number < 10 ? '0' + number : number
  }

  _createDttm() {
    const date = new Date()
    return `${date.getFullYear()}${this._prefixNumber(date.getMonth())}` +
      `${this._prefixNumber(date.getDay())}${this._prefixNumber(date.getHours())}` +
      `${this._prefixNumber(date.getMinutes())}${this._prefixNumber(date.getSeconds())}`
  }

  _sign(text) {
    return crypto.createSign('sha1').update(text).sign(this.config.privateKey, 'base64')
  }

  _verify(text, signature) {
    return crypto.createVerify('sha1').update(text).verify(this.config.bankPublicKey, signature, 'base64')
  }

  _createMessageArray(data, keys) {
    if (!keys) {
      keys = Object.keys(data)
    }
    return keys.map(key => data[key]).filter(item => typeof (item) !== 'undefined')
  }

  _createMessageString(data, keys) {
    return this._createMessageArray(data, keys).join('|')
  }

  _createPayloadMessage(payload) {

    const payloadKeys = [
      'merchantId', 'orderNo', 'dttm', 'payOperation', 'payMethod',
      'totalAmount', 'currency', 'closePayment', 'returnUrl', 'returnMethod'
    ]
    const cartItemKeys = ['name', 'quantity', 'amount', 'description']
    let payloadMessageArray = this._createMessageArray(payload, payloadKeys)
    payload.cart.forEach(cartItem => {
      payloadMessageArray = payloadMessageArray.concat(this._createMessageArray(cartItem, cartItemKeys))
    })
    payloadMessageArray = payloadMessageArray.concat(this._createMessageArray(payload, [
      'description', 'merchantData', 'customerId', 'language', 'ttlSec', 'logoVersion', 'colorSchemeVersion'
    ]))
    return payloadMessageArray.join('|')
  }

  _createResultMessage(result) {
    const RESULT_KEYS = [
      'payId', 'dttm', 'resultCode', 'resultMessage', 'paymentStatus', 'authCode', 'merchantData'
    ]
    return this._createMessageString(result, RESULT_KEYS)
  }


  // init - 1. krok - inicializace platby
  async init(payload) {
    payload["signature"] = this._sign(this._createPayloadMessage(payload))
    this.logger('init', payload)
    const result = await request({
      url: `${this.config.gateUrl}/payment/init`,
      method: "POST",
      json: true,
      body: payload
    })
    if (this._verify(this._createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      } else {
        throw result
      }
    }
    throw new Error('Init - Verification failed')

  }

  // process - 2.krok - redirect url
  getRedirectUrl(id) {
    const dttm = this._createDttm()
    const signature = this._sign(this._createMessageString({
      merchantId: this.config.merchantId,
      payId: id,
      dttm
    }))
    const url = `${this.config.gateUrl}/payment/process/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`
    this.logger('redirectUrl', url)
    return url
  }

  // status
  async status(id) {
    const dttm = this._createDttm()
    const signature = this._sign(this._createMessageString({
      merchantId: this.config.merchantId,
      payId: id,
      dttm
    }))

    const url = `${this.config.gateUrl}/payment/status/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`
    this.logger('status', url)
    const result = request({
      url,
      method: "GET",
      json: true
    })
    const message = this._createResultMessage(result)

    if (this._verify(message, result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      } else {
        throw result
      }
    }
    throw new Error('Status - Verification failed')

  }

  // reverse
  async reverse(id) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this._createDttm()
    }

    payload["signature"] = this._sign(this._createMessageString(payload))
    this.logger('reverse', payload)
    const result = request({
      url: `${this.config.gateUrl}/payment/reverse`,
      method: "PUT",
      json: true,
      body: payload
    })
    if (this._verify(this._createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      } else {
        throw result
      }
    }
    throw new Error('Reverse - Verification failed')

  }

//close
  close(id, amount) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this._createDttm(),
      amount
    }

    payload["signature"] = this._sign(this._createMessageString(payload))
    this.logger('close', payload)
    const result = request({
      url: `${this.config.gateUrl}/payment/close`,
      method: "PUT",
      json: true,
      body: payload
    })
    if (this._verify(this._createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      } else {
        throw result
      }
    }
    throw new Error('Close - Verification failed')


  }

//refund
  async refund(id, amount) {
    const payload = {
      merchantId: this.config.merchantId,
      payId: id,
      dttm: this._createDttm(),
      amount
    }

    payload["signature"] = this._sign(this._createMessageString(payload))
    this.logger('refund', payload)
    const result = request({
      url: `${this.config.gateUrl}/payment/refund`,
      method: "PUT",
      json: true,
      body: payload
    })
    if (this._verify(this._createResultMessage(result), result.signature)) {
      if (result.resultCode.toString() === '0') {
        return result
      } else {
        throw result
      }
    }
    throw new Error('Refund - Verification failed')


  }

//refund
  async echo(method = 'POST') {
    const payload = {
      merchantId: this.config.merchantId,
      dttm: this._createDttm()
    }

    payload["signature"] = this._sign(this._createMessageString(payload))
    this.logger('echo', payload)
    if (method === 'POST') {
      const result = await request({
        url: `${this.config.gateUrl}/echo`,
        method: 'POST',
        json: true,
        body: payload
      })
      if (this._verify(this._createResultMessage(result), result.signature)) {
        if (result.resultCode.toString() === '0') {
          return result
        } else {
          throw result
        }
      }
    } else {
      const result = await request({
        url: `${this.config.gateUrl}/echo/${payload.merchantId}/${payload.dttm}/${encodeURIComponent(payload.signature)}`,
        method: 'GET',
        json: true
      })
      if (this._verify(this._createResultMessage(result), result.signature)) {
        if (result.resultCode.toString() === '0') {
          return result
        } else {
          throw result
        }
      }

    }
    throw new Error('Echo - Verification failed')
  }


  payOrder(order, close = true, options = {}) {
    const payload = Object.assign(options, this.config.payloadTemplate)
    payload['orderNo'] = order.id
    payload['dttm'] = this._createDttm()
    payload['description'] = order.description
    payload['cart'] = order.items
    payload['totalAmount'] = order.items.reduce((sum, item) => sum + item.amount, 0)
    payload['closePayment'] = close
    if (order.merchantData) {
      payload['merchantData'] = Buffer.from(order.merchantData).toString('base64')
    }
    this.logger('payOrder', payload)
    return this.init(payload).then(result => {
      this.logger('payOrder - result', result)
      return this.getRedirectUrl(result.payId)
    })
  }

  async verifyResult(result) {
    if (result.resultCode.toString() === '0') {
      if (this._verify(this._createResultMessage(result), result.signature)) {
        this.logger('verifyResult', result)
        result['merchantData'] = Buffer.from(result.merchantData, 'base64').toString('ascii')
        return result
      } else {
        throw new Error('Verification failed')
      }
    }
  }
}
