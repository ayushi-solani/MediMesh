# Windows / VS Code setup for MediMesh

## Requirements
Install Node.js 20.9 or later, Git and VS Code. Confirm:

```powershell
node --version
npm.cmd --version
```

## Extract and run
Open VS Code > File > Open Folder > select the extracted `medimesh-complete` folder containing package.json.
Open **Terminal > New Terminal** and run:

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Then open http://localhost:3000.

**PowerShell error `npm.ps1 cannot be loaded because running scripts is disabled`:** Use `npm.cmd` as shown. This avoids changing your execution policy.

## Common problems
- **ENOENT package.json:** Your terminal is not inside the extracted project folder. Run `Get-Location` and `dir`.
- **Port 3000 is already in use:** Next.js may offer port 3001; open the URL it prints.
- **npm install fails:** Check internet access, run `npm.cmd cache verify`, then retry. Do not delete project source files.
- **Firebase missing env vars:** The default `.env.example` uses `NEXT_PUBLIC_APP_MODE=demo` so Firebase credentials are not needed. Do not switch to Firebase mode before configuration.
- **Changes not visible:** Restart the dev server after editing `.env.local`.

## Test

```powershell
npm.cmd test
```

Tests use the built-in Node.js test runner. Real Firestore integration tests require Firebase configuration and are a separate validation step.
