import { docPouchOrigin, frameAncestors } from './csp';
import { toolchainManifest } from '../toolchain/manifest';

describe('CSP helpers', () => {
  const backup = { ...process.env };
  afterEach(() => (process.env = { ...backup }));

  it('allows DocPouch and the OIDC issuer, also on different hosts', () => {
    process.env.DOCPOUCH_URL = 'https://docpouch.pantek.app/';
    process.env.DOCPOUCH_OIDC_ISSUER = 'https://login.pantek.app/oidc';
    expect(docPouchOrigin()).toEqual([
      'https://docpouch.pantek.app',
      'https://login.pantek.app',
    ]);
  });

  it('lists the same origin only once and ignores invalid values', () => {
    process.env.DOCPOUCH_URL = 'https://docpouch.pantek.app';
    process.env.DOCPOUCH_OIDC_ISSUER = 'https://docpouch.pantek.app/oidc';
    expect(docPouchOrigin()).toEqual(['https://docpouch.pantek.app']);
    process.env.DOCPOUCH_OIDC_ISSUER = 'not a url';
    expect(docPouchOrigin()).toEqual(['https://docpouch.pantek.app']);
  });

  it('frame ancestors from a comma separated list', () => {
    process.env.FRAME_ANCESTORS = 'https://a.ch, https://b.ch,';
    expect(frameAncestors()).toEqual(['https://a.ch', 'https://b.ch']);
  });
});

describe('Toolchain manifest', () => {
  it('has an icon within the Tool Manager limits (PNG, max. 40 KB, max. 256 px)', () => {
    const icon = toolchainManifest.icon;
    expect(icon.startsWith('data:image/png;base64,')).toBe(true);
    const bytes = Buffer.from(icon.split(',')[1], 'base64');
    expect(bytes.length).toBeLessThanOrEqual(40 * 1024);
    // PNG header: width and height at byte 16 and 20
    expect(bytes.readUInt32BE(16)).toBeLessThanOrEqual(256);
    expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(256);
  });

  it('keeps the stable role key', () => {
    expect(toolchainManifest.roles.map((r) => r.key)).toEqual([
      'peerGradingResult',
    ]);
  });
});
