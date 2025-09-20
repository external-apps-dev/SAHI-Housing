# Housing Onboarding Tracker (GitHub Pages + Firebase)

This is a static, Firebase-backed dashboard designed to run on GitHub Pages under a project site (https://<user>.github.io/<repo>/).

## Deploy to GitHub Pages

1. Push this folder as the repository root (index.html at the top level).
2. In GitHub: Settings → Pages → Build and deployment
    - Source: Deploy from a branch
    - Branch: main (or your default) / root
3. Wait for Pages to publish, then open: https://<user>.github.io/<repo>/

Notes for project vs. user sites:
- Project sites host under /<repo>/. All asset links in this project are relative, so no changes needed.

## Firebase configuration

- Firebase Web SDK is embedded via CDN in `index.html` and initialized with the provided config.
- Firestore path used: document `ln/requests` with fields:
   - `requests: Array`
   - `updatedAt: serverTimestamp()`

Security rules considerations (example open rules for prototyping only):
```
rules_version = '2';
service cloud.firestore {
   match /databases/{database}/documents {
      match /ln/{docId} {
         allow read, write: if true; // Prototype only; restrict before production
      }
   }
}
```

## PWA and Service Worker

- `assets/manifest.json` has `start_url` and `scope` set to `../` so installed app paths work under /<repo>/.
- `service-worker.js` caches only same-origin GET requests and bypasses cross-origin (e.g., Firebase), preventing stale API responses.
- Cache name: `housing-onboarding-cache-v2`. Bump this string when you make substantial static changes to force clients to update.

## First run and data sync

- On load, an intro overlay shows “Connecting to Firebase…” and blocks until Firestore is reachable.
- Initial data selection:
   - If remote doc has data: loads and renders it.
   - If remote is empty but localStorage has data: renders local and schedules an upload.
- Ongoing sync: every 2 seconds the app pulls if the cloud is newer and pushes if local edits are pending.

## Troubleshooting

- If you see “Firebase: offline” and it never connects, verify Firestore rules allow reads to `ln/requests` for unauthenticated users (or add auth and wire it in).
- Pages caching: browsers may cache aggressively. Use a hard refresh or increment the SW cache name when shipping changes.
- OneDrive artifacts (if present) are not in use. You can delete `onedrive.js` and `config.example.js` safely.

## Development tips

- Test the 2-tab sync: open the site in two tabs, edit in one, watch the other update within ~2s.
- To reset data, clear localStorage or click the Clear button in the UI if present.
