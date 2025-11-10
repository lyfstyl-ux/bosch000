// Lightweight dev entry that ensures dotenv runs before any other module imports.
// This prevents import-time modules (like server/db.ts) from seeing undefined env vars.
import 'dotenv/config';
import './index';
