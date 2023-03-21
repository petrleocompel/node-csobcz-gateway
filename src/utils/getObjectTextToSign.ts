type Value = string | number | boolean

export const getObjectTextToSign = (object: { [key: string]: unknown }) => {
	const values: Value[] = []

	const iterate = (object: object) => {
		Object.values(object).forEach((value: unknown) => {
			if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
				iterate(value)
			} else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
				values.push(value)
			}
		})
	}
	iterate(object)

	return values.map((value) => String(value)).join('|')
}
