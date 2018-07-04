/* global process */

const crypto = require('crypto');
const rp = require('request-promise-native');
const RSVP = require('rsvp');

const CSOBPaymentModule = class CSOBPaymentModule {
  constructor(config = {}) {
    this.logger = config.logging ?
      typeof(config.logging) === 'function' ?
        config.logging : console.log
      : function() {};

    const configuration = {
      gateUrl: config.gateUrl || process.env.GATEWAY_URL,
      privateKey: config.privateKey || process.env.MERCHANT_PRIVATE_KEY,
      merchantPublicKey: config.merchantPublicKey || process.env.MERCHANT_PUBLIC_KEY,
      bankPublicKey: config.bankPublicKey || process.env.BANK_PUBLIC_KEY,
      calbackUrl: config.calbackUrl || process.env.CALLBACK_URL,
      merchantId: config.merchantId || process.env.MERCHANT_ID
    }

    const PAYLOAD_TEMPLATE = {
      "merchantId": configuration.merchantId,
      "payOperation":"payment",
      "payMethod":"card",
      "currency":"CZK",
      "language":"CZ",
      "returnUrl": configuration.calbackUrl,
      "returnMethod":"POST"
    }

    configuration.payloadTemplate = PAYLOAD_TEMPLATE;
    this.config = configuration;
  }

  _prefixNumber(number) {
    return number < 10 ? '0'+number : number;
  }

  _createDttm() {
    const date = new Date();
    return `${date.getFullYear()}${this._prefixNumber(date.getMonth())}`+
    `${this._prefixNumber(date.getDay())}${this._prefixNumber(date.getHours())}`+
    `${this._prefixNumber(date.getMinutes())}${this._prefixNumber(date.getSeconds())}`;
  }

  _sign(text) {
    return crypto.createSign('sha1').update(text).sign(this.config.privateKey, "base64");
  }

  _verify(text, signature) {
    return crypto.createVerify('sha1').update(text).verify(this.config.bankPublicKey, signature, "base64");
  }

  _createMessageArray(data, keys) {
    if (!keys) {
      keys = Object.keys(data);
    }
    return keys.map(key => data[key]).filter(item => typeof(item) !=='undefined');
  }

  _createMessageString(data, keys) {
    return this._createMessageArray(data, keys).join('|');
  }

  _createPayloadMessage(payload) {

    const payloadKeys = [
      'merchantId', 'orderNo', 'dttm', 'payOperation', 'payMethod',
      'totalAmount', 'currency', 'closePayment', 'returnUrl', 'returnMethod'
    ];
    const cartItemKeys = ['name', 'quantity', 'amount', 'description']
    let payloadMessageArray = this._createMessageArray(payload, payloadKeys);
    payload.cart.forEach(cartItem => {
      payloadMessageArray = payloadMessageArray.concat(this._createMessageArray(cartItem, cartItemKeys));
    });
    payloadMessageArray = payloadMessageArray.concat(this._createMessageArray(payload, [
      'description', 'merchantData', 'customerId', 'language', 'ttlSec', 'logoVersion', 'colorSchemeVersion'
    ]));
    return payloadMessageArray.join('|');
  }

  _createResultMessage(result) {
    const RESULT_KEYS = [
      'payId', 'dttm', 'resultCode', 'resultMessage', 'paymentStatus', 'authCode', 'merchantData'
    ];
    return this._createMessageString(result, RESULT_KEYS);
  }


  // init - 1. krok - inicializace platby
  init(payload) {
    return new RSVP.Promise((resolve, reject) => {
      payload["signature"] = this._sign(this._createPayloadMessage(payload))
      this.logger('init', payload);
      rp({
        url: `${this.config.gateUrl}/payment/init`,
        method: "POST",
        json: true,
        body: payload
      }).then(result => {
        if (this._verify(this._createResultMessage(result), result.signature)) {
          if (result.resultCode.toString() === '0') {
            resolve(result)
          } else {
            reject(result);
          }
        } else {
          reject(Error('Init - Verification failed'));
        }
      }).catch(error => {
        reject(error);
      });
    })
  };

  // process - 2.krok - redirect url
  getRedirectUrl(id) {
    const dttm = this._createDttm();
    const signature = this._sign(this._createMessageString({
      merchantId: this.config.merchantId,
      payId: id,
      dttm
    }))
    const url = `${this.config.gateUrl}/payment/process/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`;
    this.logger('redirectUrl', url);
    return url;
  }

  // status
  status(id) {
    return new RSVP.Promise((resolve, reject) => {
      const dttm = this._createDttm();
      const signature = this._sign(this._createMessageString({
        merchantId: this.config.merchantId,
        payId: id,
        dttm
      }))

      const url = `${this.config.gateUrl}/payment/status/${this.config.merchantId}/${id}/${dttm}/${encodeURIComponent(signature)}`;
      this.logger('status', url);
      rp({
        url,
        method: "GET",
        json: true
      }).then(result => {
        const message = this._createResultMessage(result);

        if (this._verify(message, result.signature)) {
          if (result.resultCode.toString() === '0') {
            resolve(result)
          } else {
            reject(result);
          }
        } else {
          reject(Error('Status - Verification failed'));
        }
      }).catch(error => {
        reject(error);
      });
    })
  }

  // reverse
  reverse(id) {
    return new RSVP.Promise((resolve, reject) => {
      const payload = {
        merchantId: this.config.merchantId,
        payId: id,
        dttm: this._createDttm(),
      }

      payload["signature"] = this._sign(this._createMessageString(payload))
      this.logger('reverse', payload);
      rp({
        url: `${this.config.gateUrl}/payment/reverse`,
        method: "PUT",
        json: true,
        body: payload
      }).then(result => {
        if (this._verify(this._createResultMessage(result), result.signature)) {
          if (result.resultCode.toString() === '0') {
            resolve(result)
          } else {
            reject(result);
          }
        } else {
          reject(Error('Reverse - Verification failed'));
        }
      }).catch(error => {
        reject(error);
      });
    })
  };

  //close
  close(id, amount) {
    return new RSVP.Promise((resolve, reject) => {
      const payload = {
        merchantId: this.config.merchantId,
        payId: id,
        dttm: this._createDttm(),
        amount
      }

      payload["signature"] = this._sign(this._createMessageString(payload))
      this.logger('close', payload);
      rp({
        url: `${this.config.gateUrl}/payment/close`,
        method: "PUT",
        json: true,
        body: payload
      }).then(result => {
        if (this._verify(this._createResultMessage(result), result.signature)) {
          if (result.resultCode.toString() === '0') {
            resolve(result)
          } else {
            reject(result);
          }
        } else {
          reject(Error('Close - Verification failed'));
        }
      }).catch(error => {
        reject(error);
      });
    })
  };

  //refund
  refund(id, amount) {
    return new RSVP.Promise((resolve, reject) => {
      const payload = {
        merchantId: this.config.merchantId,
        payId: id,
        dttm: this._createDttm(),
        amount
      }

      payload["signature"] = this._sign(this._createMessageString(payload))
      this.logger('refund', payload);
      rp({
        url: `${this.config.gateUrl}/payment/refund`,
        method: "PUT",
        json: true,
        body: payload
      }).then(result => {
        if (this._verify(this._createResultMessage(result), result.signature)) {
          if (result.resultCode.toString() === '0') {
            resolve(result)
          } else {
            reject(result);
          }
        } else {
          reject(Error('Refund - Verification failed'));
        }
      }).catch(error => {
        reject(error);
      });
    })
  };

  //refund
  echo(method = 'POST') {
    return new RSVP.Promise((resolve, reject) => {
      const payload = {
        merchantId: this.config.merchantId,
        dttm: this._createDttm()
      }

      payload["signature"] = this._sign(this._createMessageString(payload));
      this.logger('echo', payload);
      if (method === 'POST') {
        rp({
          url: `${this.config.gateUrl}/echo`,
          method: 'POST',
          json: true,
          body: payload
        }).then(result => {
          if (this._verify(this._createResultMessage(result), result.signature)) {
            if (result.resultCode.toString() === '0') {
              resolve(result)
            } else {
              reject(result);
            }
          } else {
            reject(Error('Echo - Verification failed'));
          }
        }).catch(error => {
          reject(error);
        });
      } else {
        rp({
          url: `${this.config.gateUrl}/echo/${payload.merchantId}/${payload.dttm}/${encodeURIComponent(payload.signature)}`,
          method: 'GET',
          json: true
        }).then(result => {
          if (this._verify(this._createResultMessage(result), result.signature)) {
            if (result.resultCode.toString() === '0') {
              resolve(result)
            } else {
              reject(result);
            }
          } else {
            reject(Error('Echo - Verification failed'));
          }
        }).catch(error => {
          reject(error);
        });
      }
    })
  };




  payOrder(order, close = true, options = {}) {
    const payload = Object.assign(options, this.config.payloadTemplate);
    payload['orderNo'] = order.id
    payload['dttm'] = this._createDttm();
    payload['description'] = order.description;
    payload['cart'] = order.items;
    payload['totalAmount'] = order.items.reduce((sum, item) => sum + item.amount, 0);
    payload['closePayment'] = close;
    if (order.merchantData) {
      payload['merchantData'] = Buffer.from(order.merchantData).toString('base64');
    }
    this.logger('payOrder', payload);
    return this.init(payload).then(result => {
      this.logger('payOrder - result', result);
      return this.getRedirectUrl(result.payId);
    });
  }

  verifyResult(result) {
    return new RSVP.Promise((resolve, reject) => {
      if (result.resultCode.toString() === '0') {
        if (this._verify(this._createResultMessage(result), result.signature)) {
          this.logger('verifyResult', result);
          result['merchantData'] = Buffer.from(result.merchantData, 'base64').toString('ascii');
          resolve(result);
        } else {
          reject(Error('Verification failed'));
        }
      } else {
        reject(result);
      }
    });
  }
}

module.exports.CSOBPaymentModule = CSOBPaymentModule;
