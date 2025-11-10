import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import serverless from 'serverless-http';
import path from 'path';

// Important: registerRoutes wires all /api/* routes. It returns an http.Server but
// we only need the Express app for the serverless handler.
import { registerRoutes } from '../server/routes';

// Create and configure the Express app similarly to `server/index.ts` but
// avoid starting any long-running services (sockets, crons, listeners).
const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'creatorland-admin-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  }
}));

declare global {
  namespace Express {
    interface Request {
      rawBody?: unknown;
    }
  }
}

// Preserve raw body for signature verification where used
app.use(express.json({
  verify: (req, _res, buf) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Simple request logger for /api routes (keeps parity with server/index.ts)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on('finish', () => {
    if (path.startsWith('/api')) {
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch (_) {}
      }

      if (logLine.length > 240) logLine = logLine.slice(0, 239) + '…';
      // Vercel will capture console output; keep logging minimal
      // eslint-disable-next-line no-console
      console.log(logLine);
    }
  });

  next();
});

// Register routes (this wires all /api/* handlers). registerRoutes returns an http.Server
// instance, but we can ignore it for serverless usage.
(async () => {
  try {
    await registerRoutes(app as any);
    // eslint-disable-next-line no-console
    console.log('✅ API routes registered for serverless handler');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to register API routes for serverless handler', err);
  }
})();

// Export the serverless handler
export const handler = serverless(app as any);
export default handler;
