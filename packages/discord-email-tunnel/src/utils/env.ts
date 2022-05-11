import process from 'node:process';

export function checkEnvironmentVariables() {
	const environmentVariables = [
		'GOOGLE_CLOUD_CLIENT_ID',
		'GOOGLE_CLOUD_CLIENT_SECRET',
		'GOOGLE_CLOUD_REFRESH_TOKEN',
		'GOOGLE_CLOUD_PRIVATE_KEY',
		'GOOGLE_CLOUD_CLIENT_EMAIL',
	];

	for (const environmentVariable of environmentVariables) {
		if (process.env[environmentVariable] === undefined) {
			throw new Error(
				`Environment variable ${environmentVariable} not found in environment.`
			);
		}
	}
}
