import * as dotenv from 'dotenv';
import { execaCommandSync } from 'execa';
import * as fs from 'node:fs';

const envVariables = dotenv.parse(fs.readFileSync('.env'));

const flyEnvVariables = Object.entries(envVariables)
	.map(([key, value]) => `${key}=${value}`)
	.join('\n');

execaCommandSync('flyctl secrets import', {
	input: flyEnvVariables,
	reject: false,
	stdout: 'inherit',
	stderr: 'inherit',
});
