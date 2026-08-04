import 'dotenv/config';
import { AppModule } from './app.module';
import { bootstrap } from './bootstrap';

// All-in-one dev entrypoint (every module, one process, port 4000). Kept
// alongside the split main-platform.ts/main-xoffice.ts (Phase 1.5 Stage B) so
// local dev can still run a single process — CI/staging run the split
// topology instead, so the process boundary is actually exercised there.
void bootstrap(AppModule, Number(process.env.PORT ?? 4000));
