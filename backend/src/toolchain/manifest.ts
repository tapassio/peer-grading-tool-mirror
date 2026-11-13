/**
 * Toolchain Family manifest for the Peer Grading Tool.
 *
 * Served at `<base>/manifest.json` with CORS enabled so the Toolchain Tool
 * Manager (TTM) can fetch and validate it. Role keys must stay stable across
 * versions because they become keys in `content.assignments` of the Tool
 * Details Document in DocPouch.
 */
export const toolchainManifest = {
  tool: 'Peer Grading',
  version: '1.0.0',
  matchBy: 'content.assignments',
  description:
    'Peer-Grading für Gruppenarbeiten: Kriterien, Gewichtung, anonyme Bewertung und aggregierte Auswertung.',
  roles: [
    {
      key: 'peerGradingResult',
      name: 'Peer Grading Result',
      direction: 'provides',
      description:
        'Aggregiertes, anonymisiertes Ergebnis einer Peer-Grading-Kampagne pro Peer (ohne Namen, E-Mail-Adressen oder Kommentare).',
      structure: [
        { key: 'campaignName', display: 'Campaign', type: 'string' },
        { key: 'campaignId', display: 'Campaign ID', type: 'number' },
        { key: 'publishedAt', display: 'Published at', type: 'string' },
        { key: 'results', display: 'Results', type: 'array', items: 'object' },
      ],
    },
  ],
};

/** DocPouch type/subType pair used by the result structure. */
export const PGT_RESULT_TYPE = 100;
export const PGT_RESULT_SUBTYPE = 0;
