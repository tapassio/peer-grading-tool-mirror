import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { toolchainManifest } from './toolchain/manifest';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigins = configService.get<string[]>('corsOrigins') || [];
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  } else {
    // Development default: allow every origin.
    app.enableCors();
  }

  // e.g. APP_BASE_PATH=/tc/PeerGrading -> global prefix tc/PeerGrading/api
  const basePath = configService.get<string>('basePath') || '';
  const apiPath = `${basePath}/api`;
  app.setGlobalPrefix(apiPath.replace(/^\/+/, ''));

  // Initialize Nest (middleware + routes) before adding the SPA fallback, so
  // the fallback only runs when no static file or route matched.
  await app.init();

  // Toolchain Family manifest. Served with CORS so the Toolchain Tool Manager
  // (TTM) can fetch and validate it from another origin. Registered on the
  // raw HTTP adapter because it lives outside the API global prefix.
  const manifestPath = `${basePath}/manifest.json`;
  app.getHttpAdapter().get(manifestPath, (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.json(toolchainManifest);
  });

  // SPA fallback: deep links (e.g. the OIDC callback or peer grading links)
  // are handled by Angular, not by the backend. The language-specific index
  // files are served by ServeStaticModule; this only catches paths without a
  // matching static file.
  if (configService.get('production')) {
    const indexFilePath = join(
      __dirname,
      '..',
      'frontend',
      'en',
      'index.html',
    );
    const server = app.getHttpAdapter().getInstance();

    server.get('*', (req, res, next) => {
      // Never swallow API calls or missing static assets.
      if (req.path.startsWith(apiPath) || req.path.includes('.')) {
        return next();
      }
      if (!existsSync(indexFilePath)) {
        return next();
      }
      res.sendFile(indexFilePath);
    });
  }

  await app.listen(process.env.PORT ? +process.env.PORT : 3000);
}
bootstrap();
