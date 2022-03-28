import * as process from 'node:process';

export function logDebug(cb: () => string) {
	if (process.env.NODE_ENV === 'development') {
		console.log(cb());
	}
}
