export interface Item {
  name: string
  quantity: number
  amount: number
  description: string
}

export interface Order {
  id: string
  description: string
  items: Item[]
  merchantData: Buffer
}

export enum Currency {
  CZK = 'CZK',
  USD = 'USD'
}

export enum ReturnMethod {
  POST = 'POST',
  GET = 'GET'
}

export enum Language {
  CZ = 'CZ',
  EN = 'EN'
}

export enum PaymentOperation {
  PAYMENT = 'payment',
  ONE_CLICK_PAYMENT = 'oneclickPayment'
}

export enum PaymentMethod {
  CARD = 'card'
}

export interface InputPayload {
  orderNo: string,
  totalAmount: number,
  currency: Currency,
  cart: Item[],
  description: string,
}

export interface InitPayload {
  merchantId: string,
  orderNo: string,
  dttm: string,
  payOperation: PaymentOperation,
  payMethod: PaymentMethod,
  totalAmount: number,
  currency: Currency,
  closePayment: boolean,
  returnUrl: string,
  returnMethod: ReturnMethod,
  cart: Item[],
  description: string,
  language: Language,
}
