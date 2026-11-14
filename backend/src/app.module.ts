import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import type { ServeStaticModuleOptions } from '@nestjs/serve-static';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import config from './config';
import { PrismaService } from './prisma.service';
import { CampaignService } from './campaign/campaign.service';
import { CampaignController } from './campaign/campaign.controller';
import { GroupService } from './group/group.service';
import { GroupController } from './group/group.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PdfService } from './pdf/pdf.service';
import { PdfController } from './pdf/pdf.controller';
import { CalculationsService } from './calculations/calculations.service';
import { ScheduleModule } from '@nestjs/schedule';
import { SendgridService } from './sendgrid/sendgrid.service';
import { ExcelService } from './excel/excel.service';
import { ExcelController } from './excel/excel.controller';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { SanitizeService } from './sanitize/sanitize.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Rate limit: max. 100 requests per minute and IP for every route.
    // Login and registration have stricter limits (see auth.controller.ts).
    // (@nestjs/throttler 6: ttl in milliseconds)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ConfigModule.forRoot({
      load: [config],
      isGlobal: true,
    }),
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        if (!config.get('production')) {
          return [];
        }

        const base = config.get<string>('basePath') || '';
        // Express 5 / path-to-regexp 8 syntax: never serve files for the API
        const exclude = [`${base}/api/{*path}`];
        const english = join(__dirname, '..', 'frontend', 'en');
        const german = join(__dirname, '..', 'frontend', 'de');

        const options: ServeStaticModuleOptions[] = [
          {
            rootPath: english, // actual files of the english app
            exclude,
            serveRoot: `${base}/en`,
          },
          {
            rootPath: german, // actual files of the german app
            exclude,
            serveRoot: `${base}/de`, // on what url to find it
          },
        ];

        // fallback for when the url has neither /de nor /en
        options.push(
          base
            ? { rootPath: english, exclude, serveRoot: base }
            : { rootPath: english, exclude },
        );

        // important: the fallback has to be the last entry
        return options;
      },
      inject: [ConfigService],
    }),
    I18nModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: 'en',
        fallbacks: {
          'de-*': 'de',
          'en-*': 'en',
        },
        loaderOptions: {
          path: join(__dirname, '/i18n/'),
          // reloading translation files is only useful during development
          watch: !configService.get('production'),
        },
      }),
      resolvers: [new HeaderResolver(['lang'])],
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
  ],
  controllers: [
    AppController,
    CampaignController,
    GroupController,
    PdfController,
    ExcelController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AppService,
    PrismaService,
    CampaignService,
    GroupService,
    PdfService,
    CalculationsService,
    // CronJobsService,
    SendgridService,
    ExcelService,
    SanitizeService,
  ],
})
export class AppModule {}
