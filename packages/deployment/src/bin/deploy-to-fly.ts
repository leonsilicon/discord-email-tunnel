import { execaCommandSync } from 'execa';
import { chProjectDir } from 'lion-system';

chProjectDir(import.meta.url, { monorepoRoot: true });

// Looks like it's broken when dealing with \n inside .env strings
// const envVariables = fs.readFileSync('.env', 'utf8');
// execaCommandSync('flyctl secrets import', {
// 	input: envVariables,
// 	reject: false,
// });

execaCommandSync(
	'flyctl deploy --local-only --dockerfile ./packages/deployment/dockerfiles/Dockerfile',
	{ stdio: 'inherit' }
);
