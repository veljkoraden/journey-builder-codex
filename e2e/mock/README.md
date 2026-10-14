# Pinned challenge mock

These files come from the official [frontendchallengeserver](https://github.com/mosaic-avantos/frontendchallengeserver/tree/fdfbb9c78eb8ac518f952be183a3718098005265) at revision `fdfbb9c78eb8ac518f952be183a3718098005265`:

- `index.cjs`: byte-identical copy of upstream `index.js`, renamed for CommonJS execution inside this ESM repository.
- `graph.json`: byte-identical graph response fixture.
- `upstream-package.json`: upstream package metadata, including its declared ISC license.
- `provenance.json`: source URL/revision and SHA-256 checksums, verified before every test worker starts.

The test environment copies these files into its own temporary directory. It changes only the server's listen call in that temporary copy: loopback binding, OS-assigned port, and an IPC readiness message. Route handling, data reads, success CORS headers, and error responses remain unchanged.

Tests mutate only temporary copies of graph/configuration data, then reset them between scenarios. No existing local server or development file is modified. The suite has no network dependency on GitHub once dependencies and Chromium are installed.

To update the fixture deliberately, fetch an explicit upstream commit, replace all copied files, regenerate checksums, review the diff, and rerun all tests. Do not change checksums merely to silence a mismatch.
