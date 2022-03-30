declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV: 'production' | 'development';
			GOOGLE_CLOUD_CLIENT_ID: string;
			GOOGLE_CLOUD_CLIENT_SECRET: string;
			GOOGLE_CLOUD_REFRESH_TOKEN: string;
			GOOGLE_CLOUD_PRIVATE_KEY: string;
			GOOGLE_CLOUD_CLIENT_EMAIL: string;
		}
	}
}

export {};
