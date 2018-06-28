# ČSOB CZ payment modules

[Source](https://github.com/mival/csob_gateway)|
[Gateway documentation](https://github.com/csob/paymentgateway)

Module for ČSOB CZ payment gateway

## Instalation
npm i csobcz_payment_gateway

## Available methods
* ```status(string payId)``` - returns payment status
* ```init(json payload)``` - payment init
* ```reverse(string payId)``` - reverse payment with given payId
* ```close(string payId)``` - close payment with given payId
* ```refund(string payId, int amount)``` - refund payment with given payId, if
amount specified given amount is refunded
* ```echo(string method)``` - echo test, method is either ```GET``` or ```POST``` (default)
* ```verifyResult(json payload)``` - if **success** returns ```payload``` else returns error,
payload is json returned from gateway callback.
-------------------

### Extra methods
* ```payOrder(json order, close)``` - wrapper for init and getRedirectUrl, ```close``` params is ```closePayment``` value
order example
```json
{
  "id": "order1",
  "description": "Moje order",
  "items": [{
      "name": "Nákup: vasobchod.cz",
      "quantity": 1,
      "amount": 200,
      "description": "Produkt 1"
  }]
}
```
allowed is 1-2 items.
* ```getRedirectUrl(string payId)``` - returns gateway url for redirection

## Return values/format
All methods returns ```Promise``` when **resolved** is ```JSON``` payload specified in
[Gateway documentation](https://github.com/csob/paymentgateway) only **Extra methods** returns custom payload. **Reject** is ```JS Error```.

* ```payOrder```, ```getRedirectUrl``` - returned ```JSON```
```json
{
  "url": "https://api.platebnibrana.csob.cz/api/v1.7/payment/process/MERCHANDID/PAYID/20180504105513/KZr8D0z%2FVYFlX2fy0bs2NTafv...."
}
```

## Example usage

```javascript
const gateway = require('csobcz_payment_gateway');

gateway.echo('GET').then(result => {
  logger.log(result);
}).catch(e => {
  logger.error(e);
});
```
