import 'dotenv/config';
import { XofficeAppModule } from './xoffice-app.module';
import { bootstrap } from './bootstrap';

// X.Office process (Phase 1.5 Stage B) — workflow engine, requests/
// directives/tickets/bookings/announcements, records, delivery, work, manage,
// ioc, people. New default port 4001 (set PLATFORM_API_URL for this process
// so its Delivery→Launch Factory client can reach the platform process).
// Deliberately does NOT fall back to the shared `PORT` env var — see
// bootstrap.ts's doc comment (`.env`'s PORT=4000 is the platform default;
// falling back to it here would collide with the platform process).
void bootstrap(XofficeAppModule, Number(process.env.XOFFICE_PORT ?? 4001));
