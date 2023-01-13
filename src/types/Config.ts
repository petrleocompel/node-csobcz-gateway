import Logger from 'bunyan'

export interface Config {
  gateUrl: string
  privateKey: string
  merchantPublicKey: string
  bankPublicKey: string
  calbackUrl: string
  merchantId: string,
  logger: Logger,
  payloadTemplate?: Object
}
