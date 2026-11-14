import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { toolchainManifest } from './toolchain/manifest';
import helmet from 'helmet';
import { checkSecrets } from './security/check-secrets';
import { docPouchOrigin, frameAncestors } from './security/csp';

async function bootstrap() {
  checkSecrets(process.env.PRODUCTION === 'true');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const production = configService.get<boolean>('production');

  // Behind a reverse proxy the client IP is in X-Forwarded-For.
  // Needed so that the rate limit counts per user and not per proxy.
  // Set TRUST_PROXY=1 (number of proxies) when deployed behind one.
  if (process.env.TRUST_PROXY) {
    app
      .getHttpAdapter()
      .getInstance()
      .set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  }

  // Security headers (clickjacking, MIME sniffing, HSTS, ...).
  // The CSP allows inline styles because Angular Material needs them.
  // (angular.json: inlineCritical is off, because its onload trick for
  // stylesheets would be blocked by the CSP.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'style-src': [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'", ...docPouchOrigin()],
          'frame-ancestors': ["'self'", ...frameAncestors()],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOrigins = configService.get<string[]>('corsOrigins') || [];
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  } else if (!production) {
    // Development only: allow every origin. With credentials, so that the
    // refresh cookie also works from the dev server (localhost:4200).
    app.enableCors({ origin: true, credentials: true });
  }
  // Production without CORS_ORIGINS: no CORS, only same-origin requests.

  // e.g. APP_BASE_PATH=/tc/PeerGrading -> global prefix tc/PeerGrading/api
  const basePath = configService.get<string>('basePath') || '';
  const apiPath = `${basePath}/api`;
  app.setGlobalPrefix(apiPath.replace(/^\/+/, ''));

  // Raw Express routes have to be registered before `app.init()`: Nest adds its
  // own catch-all not-found handler at the end of init, which would otherwise
  // shadow anything registered afterwards.
  const server = app.getHttpAdapter().getInstance();

  // Toolchain Family manifest. Served with CORS so the Toolchain Tool Manager
  // (TTM) can fetch and validate it from another origin. It lives outside the
  // API global prefix.
  // Also under the language paths, because operators often copy the URL
  // with the language (…/de/) into the Tool Manager.
  const sendManifest = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.json(toolchainManifest);
  };
  for (const prefix of ['', '/de', '/en']) {
    server.get(`${basePath}${prefix}/manifest.json`, sendManifest);
  }

  // SPA fallback: deep links (e.g. the OIDC callback or peer grading links)
  // are handled by Angular, not by the backend. The language-specific index
  // files are served by ServeStaticModule; this only catches paths without a
  // matching static file.
  if (configService.get('production')) {
    const frontendRoot = join(__dirname, '..', 'frontend');
    const isGerman = (path: string) =>
      path === `${basePath}/de` || path.startsWith(`${basePath}/de/`);

    server.get('*', (req, res, next) => {
      // Never swallow API calls or missing static assets.
      if (req.path.startsWith(apiPath) || req.path.includes('.')) {
        return next();
      }

      // Keep the language of the requested URL (German deep links must not
      // fall back to the English index).
      const indexFilePath = join(
        frontendRoot,
        isGerman(req.path) ? 'de' : 'en',
        'index.html',
      );

      if (!existsSync(indexFilePath)) {
        return next();
      }
      res.sendFile(indexFilePath);
    });
  }

  // Initialize Nest (middleware + routes) after the raw routes above.
  await app.init();

  await app.listen(process.env.PORT ? +process.env.PORT : 3000);
}
bootstrap();
