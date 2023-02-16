export interface Item {
	name: string
	quantity: number
	amount: number
	description?: string
}

export interface Order {
	id: string
	description: string
	items: Item[]
	merchantData: Buffer
}
