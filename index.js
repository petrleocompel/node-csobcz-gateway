/* global process */

const crypto = require('crypto');
const rp = require('request-promise-native');
const RSVP = require('rsvp');

const GATE_URL = process.env.GATEWAY_URL;
const PAYLOAD_TEMPLATE = {
  "merchantId": process.env.MERCHANT_ID,
  "payOperation":"payment",
  "payMethod":"card",
  "currency":"CZK",
  "language":"CZ",
  "returnUrl":process.env.CALLBACK_URL,
  "returnMethod":"POST"
}

const privateKey = process.env.MERCHANT_PRIVATE_KEY;
// const merchantPublicKey = process.env.MERCHANT_PUBLIC_KEY;
const bankPublicKey = process.env.BANK_PUBLIC_KEY;

function _prefixNumber(number) {
  return number < 10 ? '0'+number : number;
}

function _createDttm() {
  const date = new Date();
  return `${date.getFullYear()}${_prefixNumber(date.getMonth())}${_prefixNumber(date.getDay())}`+
  `${_prefixNumber(date.getHours())}${_prefixNumber(date.getMinutes())}${_prefixNumber(date.getSeconds())}`;
}

function _sign(text) {
  return crypto.createSign('sha1').update(text).sign(privateKey,"base64");
}

function _verify(text, signature) {
  return crypto.createVerify('sha1').update(text).verify(bankPublicKey, signature,"base64");
}

function _createMessageArray(data, keys) {
  if (!keys) {
    keys = Object.keys(data);
  }
  return keys.map(key => data[key]).filter(item => typeof(item) !=='undefined');
}

function _createMessageString(data, keys) {
  return _createMessageArray(data, keys).join('|');
}

function _createPayloadMessage(payload) {

  const payloadKeys = [
    'merchantId', 'orderNo', 'dttm', 'payOperation', 'payMethod',
    'totalAmount', 'currency', 'closePayment', 'returnUrl', 'returnMethod'
  ];
  const cartItemKeys = ['name', 'quantity', 'amount', 'description']
  let payloadMessageArray = _createMessageArray(payload, payloadKeys);
  payload.cart.forEach(cartItem => {
    payloadMessageArray = payloadMessageArray.concat(_createMessageArray(cartItem, cartItemKeys));
  });
  payloadMessageArray = payloadMessageArray.concat(_createMessageArray(payload, ['description', 'language']));
  return payloadMessageArray.join('|');
}

function _createResultMessage(result) {
  const RESULT_KEYS = [
    'payId', 'dttm', 'resultCode', 'resultMessage', 'paymentStatus', 'authCode'
  ];
  return _createMessageString(result, RESULT_KEYS);
}


// init - 1. krok - inicializace platby
function init(payload) {
  return new RSVP.Promise((resolve, reject) => {
    payload["signature"] = _sign(_createPayloadMessage(payload))
    rp({
      url: `${GATE_URL}/payment/init`,
      method: "POST",
      json: true,
      body: payload
    }).then(result => {
      if (_verify(_createResultMessage(result), result.signature)) {
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
function getRedirectUrl(id) {
  const dttm = _createDttm();
  const signature = _sign(_createMessageString({
    merchantId: process.env.MERCHANT_ID,
    payId: id,
    dttm
  }))
  return `${GATE_URL}/payment/process/${process.env.MERCHANT_ID}/${id}/${dttm}/${encodeURIComponent(signature)}`;
}

// status
function status(id) {
  return new RSVP.Promise((resolve, reject) => {
    const dttm = _createDttm();
    const signature = _sign(_createMessageString({
      merchantId: process.env.MERCHANT_ID,
      payId: id,
      dttm
    }))
    rp({
      url: `${GATE_URL}/payment/status/${process.env.MERCHANT_ID}/${id}/${dttm}/${encodeURIComponent(signature)}`,
      method: "GET",
      json: true
    }).then(result => {
      const message = _createResultMessage(result);

      if (_verify(message, result.signature)) {
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
function reverse(id) {
  return new RSVP.Promise((resolve, reject) => {
    const payload = {
      merchantId: process.env.MERCHANT_ID,
      payId: id,
      dttm: _createDttm(),
    }

    payload["signature"] = _sign(_createMessageString(payload))
    rp({
      url: `${GATE_URL}/payment/reverse`,
      method: "PUT",
      json: true,
      body: payload
    }).then(result => {
      if (_verify(_createResultMessage(result), result.signature)) {
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
function close(id, amount) {
  return new RSVP.Promise((resolve, reject) => {
    const payload = {
      merchantId: process.env.MERCHANT_ID,
      payId: id,
      dttm: _createDttm(),
      amount
    }

    payload["signature"] = _sign(_createMessageString(payload))
    rp({
      url: `${GATE_URL}/payment/close`,
      method: "PUT",
      json: true,
      body: payload
    }).then(result => {
      if (_verify(_createResultMessage(result), result.signature)) {
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
function refund(id, amount) {
  return new RSVP.Promise((resolve, reject) => {
    const payload = {
      merchantId: process.env.MERCHANT_ID,
      payId: id,
      dttm: _createDttm(),
      amount
    }

    payload["signature"] = _sign(_createMessageString(payload))
    rp({
      url: `${GATE_URL}/payment/refund`,
      method: "PUT",
      json: true,
      body: payload
    }).then(result => {
      if (_verify(_createResultMessage(result), result.signature)) {
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
function echo(method = 'POST') {
  return new RSVP.Promise((resolve, reject) => {
    const payload = {
      merchantId: process.env.MERCHANT_ID,
      dttm: _createDttm()
    }

    payload["signature"] = _sign(_createMessageString(payload));

    if (method === 'POST') {
      rp({
        url: `${GATE_URL}/echo`,
        method: 'POST',
        json: true,
        body: payload
      }).then(result => {
        if (_verify(_createResultMessage(result), result.signature)) {
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
        url: `${GATE_URL}/echo/${payload.merchantId}/${payload.dttm}/${encodeURIComponent(payload.signature)}`,
        method: 'GET',
        json: true
      }).then(result => {
        if (_verify(_createResultMessage(result), result.signature)) {
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




function payOrder(order, close = true) {
  const payload = Object.assign({}, PAYLOAD_TEMPLATE);
  payload['orderNo'] = order.id
  payload['dttm'] = _createDttm();
  payload['description'] = order.description;
  payload['cart'] = order.items;
  payload['totalAmount'] = order.items.reduce((sum, item) => sum + item.amount, 0);
  payload['closePayment'] = close;

  return init(payload).then(result => {
    return getRedirectUrl(result.payId);
  });
}

function verifyResult(result) {
  return new RSVP.Promise((resolve, reject) => {
    if (result.resultCode.toString() === '0') {
      if (_verify(_createResultMessage(result), result.signature)) {
        resolve(result);
      } else {
        reject(Error('Verification failed'));
      }
    } else {
      reject(result);
    }
  });
}

exports.payOrder = payOrder;
exports.verifyResult = verifyResult;
exports.status = status;
exports.init = init;
exports.getRedirectUrl = getRedirectUrl;
exports.reverse = reverse;
exports.close = close;
exports.refund = refund;
exports.echo = echo;
