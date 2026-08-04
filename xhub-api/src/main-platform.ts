import 'dotenv/config';
import { PlatformAppModule } from './platform-app.module';
import { bootstrap } from './bootstrap';

// XHub Platform process (Phase 1.5 Stage B) — control plane, master data,
// backup, webhook outbox dispatcher, tenant launch/catalog/onboarding/
// lifecycle. Default port 4000 (unchanged — matches the pre-split default
// every frontend fallback already assumes).
void bootstrap(PlatformAppModule, Number(process.env.PLATFORM_PORT ?? process.env.PORT ?? 4000));
