import { CSOBPaymentModule } from '../src'
import bunyan from 'bunyan'

const config = {
  gateUrl:   ...,
  privateKey: './rsa_A3806v8zjm.key',
  merchantPublicKey: './rsa_A3806v8zjm.pub',
  bankPublicKey: ...,
  calbackUrl: 'http://localhost',
  merchantId: 'A3806v8zjm',
  payloadTemplate: {}
}
describe('CSOB payment gateway library', () => {
  it('should make payment', async () => {
    const gateway = new CSOBPaymentModule({
      ...{ logging: bunyan.createLogger({ name: 'test' }) },
      ...config
    })
  })
})
