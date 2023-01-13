import { Item } from './Order'

export enum ResultCode {
  OK = 0,
  MISSING_PARAMETER = 100,
  INVALID_PARAMETER = 110,
  MERCHANT_BLOCKED = 120,
  SESSION_EXPIRED = 130,
  PAYMENT_NOT_FOUND = 140,
  PAYMENT_NOT_IN_VALID_STATE = 150,
  OPERATION_NOT_ALLOWED = 160,
  CUSTOMER_NOT_FOUND = 800,
  CUSTOM_HAS_NO_SAVED_CARDS = 810,
  CUSTOM_HAS_SAVED_CARDS = 820,
  INTERNAL_ERROR = 900
}

export enum PaymentStatus {
  CREATED = 1,
  IN_PROGRESS = 2,
  CANCELED = 3,
  REVERSED = 5,
  DECLINED = 6,
  WAITING_FOR_SETTLE = 7,
  COMPLETED = 8
}

export enum Currency {
  CZK = 'CZK',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  HUF = 'HUF',
  PLN = 'PLN',
  RON = 'RON',
  NOK = 'NOK',
  SEK = 'SEK',
}

export enum ReturnMethod {
  POST = 'POST',
  GET = 'GET'
}

export enum Language {
  CZ = 'CZ',
  EN = 'EN',
  ES = 'ES',
  PL = 'PL'
}

export enum PaymentOperation {
  PAYMENT = 'payment',
  ONE_CLICK_PAYMENT = 'oneclickPayment',
  CUSTOM_PAYMENT = 'customPayment'
}

export enum PaymentMethod {
  CARD = 'card',
  CARD_LVP = 'card#LVP'
}

export interface PaymentResult {
  payId: string,
  dttm: string,
  resultCode: ResultCode,
  resultMessage: string,
  signature: string,
  paymentStatus?: PaymentStatus,
  authCode?: string // only if resultCode in [ 4, 7, 8 ]
}

export interface OneClickPaymentInput {
  templatePaymentId: string,
  amount: number,
  orderNumber: string,
  currency: Currency
}

export interface InputPayload {
  orderNo: string,
  totalAmount: number,
  currency: Currency,
  language: Language,
  cart?: Item[],
  description: string,
  origPayId?: string
}

export interface InitPayload {
  orderNo: string,
  payOperation?: PaymentOperation,
  payMethod?: PaymentMethod,
  totalAmount: number,
  currency: Currency,
  closePayment?: boolean,
  customerId?: string,
  returnUrl: string,
  returnMethod: ReturnMethod,
  cart: Item[],
  language: Language,
}
