import { execaCommandSync } from 'execa';
import { chProjectDir } from 'lion-system';

chProjectDir(import.meta.url, { monorepoRoot: true });

execaCommandSync(
	'flyctl deploy --local-only --dockerfile ./packages/deployment/dockerfiles/Dockerfile',
	{ stdio: 'inherit' }
);
