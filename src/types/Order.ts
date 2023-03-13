import { Currency } from './Payment';

export interface Item {
	name: string;
	quantity: number;
	amount: number;
	description?: string;
}

export interface Order {
	type?: 'purchase' | 'balance' | 'prepaid' | 'cash' | 'check';
	availability?: 'now' | 'preorder';
	delivery?:
		| 'shipping'
		| 'shipping_verified'
		| 'instore'
		| 'digital'
		| 'ticket'
		| 'other';
	deliveryMode?: 0 | 1 | 2 | 3;
	deliveryEmail?: string;
	nameMatch?: boolean;
	addressMatch?: boolean;
	billing?: Address;
	shipping?: Address;
	shippingAddedAt?: string;
	reorder?: boolean;
	giftcards?: GiftCards;
}

export interface Address {
	address1: string;
	address2?: string;
	address3?: string;
	city: string;
	zip: string;
	state?: string;
	country: string;
}

export interface GiftCards {
	totalAmount?: number;
	currency?: Currency;
	quantity?: number;
}
