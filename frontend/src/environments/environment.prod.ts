/**
 * Resolves the API base at runtime so the app works both at the root and
 * under a sub-path such as /tc/PeerGrading/.
 *
 * The app is served from `<base>/en/` or `<base>/de/`; the API lives at
 * `<base>/api`. `document.baseURI` already contains the <base href> set by
 * the Angular build, so going one directory up yields the API root.
 */
function resolveApiBase(): string {
  const apiUrl = new URL('../api', document.baseURI);
  return apiUrl.pathname.replace(/\/$/, '');
}

export const environment = {
  production: true,
  api: resolveApiBase(),
  // Toolchain Dashboard — lives under the /tc/ sub-path of the Toolchain host
  // (https://tapassio.pantek.ch/Dashboard/ is 404).
  toolchainUrl: 'https://tapassio.pantek.ch/tc/Dashboard/',
};
