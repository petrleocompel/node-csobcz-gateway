export interface Customer {
	name?: string;
	email?: string;
	homePhone?: string;
	workPhone?: string;
	account?: string;
	login?: Login;
}

export interface Account {
	createdAt?: string;
	changedAt?: string;
	changedPwdAt?: string;
	orderHistory?: number;
	paymentsDay?: number;
	paymentsYear?: number;
	oneclickAdds?: number;
	suspicious?: boolean;
}

export interface Login {
	auth?: string;
	authAt?: string;
	authData?: string;
}
