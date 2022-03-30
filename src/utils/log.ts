import * as process from 'node:process';

export function logDebug(cb: () => string) {
	if (process.env.NODE_ENV !== 'production') {
		console.log(cb());
	}
}
