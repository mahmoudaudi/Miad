# Development environment

Use Node.js 22 LTS with npm 10 for this repository. Node 24/npm 11 are not
supported: npm 11 produces a platform-incomplete lockfile for this Next 14
application and causes Next to attempt its SWC lockfile repair on every start.

If you use nvm:

```bash
nvm install 22
nvm use
npm install
```

Verify the active toolchain before installing dependencies:

```bash
node --version # v22.x
npm --version  # v10.x
```

Then run the applications in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

The API is available at `http://localhost:3001/api/v1/health`; the web app is
available at `http://localhost:3000`.

Do not regenerate `package-lock.json` with Node 24/npm 11. After switching to
the supported toolchain, run `npm install` once so npm regenerates the
platform-complete lockfile through its normal resolver. Do not hand-edit lock
entries or delete uncommitted application files.
