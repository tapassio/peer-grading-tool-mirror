import { ToolchainService, normalizeToolUrl } from './toolchain.service';

/** fake DocPouch client with tool documents and structures */
function fakeClient(toolDocuments: any[], structures: any[]) {
  return {
    fetchDocuments: jest.fn().mockResolvedValue(toolDocuments),
    getStructures: jest.fn().mockResolvedValue(structures),
  } as any;
}

function service(config: any) {
  const authService: any = { getConfig: () => ({ mode: 'oidc', ...config }) };
  return new ToolchainService(authService, {} as any);
}

const tdd = (url: string, structureId: string, type = 7, subType = 0, name = 'Peer Grading') => ({
  content: { name, url, assignments: { peerGradingResult: { structureId, type, subType } } },
});

const structures = [
  { _id: 's-tm', name: 'Peer Grading Result', type: 7, subType: 0 },
  { _id: 's-dev', name: 'Peer Grading Result', type: 100, subType: 0 },
  { _id: 's-evil', name: 'Evil', type: 5, subType: 0 },
];

describe('normalizeToolUrl', () => {
  it.each([
    ['https://Host.ch/tc/PeerGrading/', 'https://host.ch/tc/PeerGrading'],
    ['https://host.ch/tc/PeerGrading/de/', 'https://host.ch/tc/PeerGrading'],
    ['https://host.ch/tc/PeerGrading/en', 'https://host.ch/tc/PeerGrading'],
    ['https://host.ch/tc/PeerGrading?x=1#y', 'https://host.ch/tc/PeerGrading'],
    ['not a url', ''],
    [undefined, ''],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeToolUrl(input as any)).toBe(expected);
  });
});

describe('ToolchainService.resolveTarget', () => {
  const own = 'https://host.ch/tc/PeerGrading';

  it('1. configured structure id has priority', async () => {
    const s = service({ publicUrl: own, resultStructureId: 's-dev' });
    const target = await s.resolveTarget(fakeClient([tdd(own, 's-tm')], structures));
    expect(target).toEqual({ structureId: 's-dev', type: 100, subType: 0 });
  });

  it('2. finds the Tool Details Document by url, also when renamed', async () => {
    const s = service({ publicUrl: own });
    const docs = [tdd(own + '/', 's-tm', 7, 0, 'Peer Grading BFH')];
    const target = await s.resolveTarget(fakeClient(docs, structures));
    // type/subType from the assignment, not 100/0
    expect(target).toEqual({ structureId: 's-tm', type: 7, subType: 0 });
  });

  it('ignores a document with the right name but another url', async () => {
    const s = service({ publicUrl: own });
    const docs = [tdd('https://evil.example/', 's-evil', 5, 0, 'Peer Grading')];
    await expect(s.resolveTarget(fakeClient(docs, structures))).rejects.toThrow(
      'PGT_RESULT_STRUCTURE_MISSING'
    );
  });

  it('refuses to guess when several documents claim this url', async () => {
    const s = service({ publicUrl: own });
    const docs = [tdd(own, 's-tm'), tdd(own, 's-evil', 5)];
    await expect(s.resolveTarget(fakeClient(docs, structures))).rejects.toThrow(
      'PGT_TOOL_DOCUMENT_AMBIGUOUS'
    );
  });

  it('3. name fallback only when allowed (development)', async () => {
    const dev = service({ publicUrl: own, allowStructureNameFallback: true });
    const target = await dev.resolveTarget(fakeClient([], structures));
    expect(target.structureId).toBe('s-tm');

    const prod = service({ publicUrl: own, allowStructureNameFallback: false });
    await expect(prod.resolveTarget(fakeClient([], structures))).rejects.toThrow(
      'PGT_RESULT_STRUCTURE_MISSING'
    );
  });
});

describe('ToolchainService.buildResult (anonymisation)', () => {
  const peer = (peerId: number, lastName: string) =>
    ({ peerId, firstName: 'X', lastName, email: `${lastName}@example.org` }) as any;

  function campaignWithScores() {
    const peers = [peer(1, 'Aebi'), peer(2, 'Bucher'), peer(3, 'Caflisch')];
    return {
      campaignId: 1,
      name: 'Demo',
      criteria: [{ criteriaId: 1, name: 'Quality', weight: 1 }],
      groups: [{ number: 1, peers, gradings: [] }],
    } as any;
  }

  // score = peerId, so we can see which person ended up as "Peer 1"
  const campaignService: any = {
    getPeersThirdPartyAverageByCriteria: (_c: any, _g: any, p: any) => p.peerId,
    getPeersSelfAverage: (_g: any, p: any) => p.peerId,
    getPeersThirdPartyAverage: (_g: any, p: any) => p.peerId,
  };

  it('contains no names or e-mails', () => {
    const s = new ToolchainService({} as any, campaignService);
    const json = JSON.stringify(s.buildResult(campaignWithScores()));
    expect(json).not.toMatch(/Aebi|Bucher|Caflisch|example\.org/);
    expect(json).toContain('Peer 1');
  });

  it('"Peer 1" is not always the first person of the class list', () => {
    const s = new ToolchainService({} as any, campaignService);
    s.random = () => 0; // shuffle with fixed numbers: order 2, 3, 1
    const rows = s.buildResult(campaignWithScores()).results;
    expect(rows.map((r) => r.peerLabel)).toEqual(['Peer 1', 'Peer 2', 'Peer 3']);
    expect(rows[0].weightedScore).not.toBe(1); // first in list is not Peer 1
    expect(rows.map((r) => r.weightedScore).sort()).toEqual([1, 2, 3]); // nobody lost
  });

  it('uses crypto random numbers by default', () => {
    const s = new ToolchainService({} as any, campaignService);
    const values = Array.from({ length: 20 }, () => s.random());
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
