import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import '@angular/localize/init';
import { TextEncoder } from 'util';

globalThis.TextEncoder = TextEncoder;

setupZoneTestEnv();
