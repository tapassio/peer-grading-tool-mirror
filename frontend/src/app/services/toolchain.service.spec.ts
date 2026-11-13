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
