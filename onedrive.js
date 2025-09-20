/*
  OneDrive/Graph integration for static sites (GitHub Pages)
  - Uses MSAL browser to authenticate user
  - Stores data file under OneDrive App's special AppFolder
  - Requires scopes: User.Read, Files.ReadWrite.AppFolder
*/

(() => {
  const cfg = window.OneDriveConfig || {};
  const log = (...a) => console.log('[OneDrive]', ...a);

  // Public API exposed on window.OneDriveDB
  const api = {
    get isConfigured() {
      return !!(cfg && cfg.msal && cfg.msal.clientId);
    },
    isSignedIn: false,
    account: null,
    async init() {
      if (!this.isConfigured) return false;
      if (!window.msal) throw new Error('MSAL not loaded');
      this.client = new msal.PublicClientApplication({
        auth: {
          clientId: cfg.msal.clientId,
          authority: cfg.msal.authority || 'https://login.microsoftonline.com/common',
          redirectUri: cfg.msal.redirectUri || window.location.origin,
        },
        cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
      });
      // Handle redirect if present
      try { await this.client.handleRedirectPromise(); } catch (e) { log('redirect error', e); }

      const accounts = this.client.getAllAccounts();
      if (accounts && accounts.length) {
        this.account = accounts[0];
        this.isSignedIn = true;
      }
      return this.isSignedIn;
    },
    async signIn() {
      if (!this.client) await this.init();
      try {
        const res = await this.client.loginPopup({ scopes: cfg.scopes || ['User.Read'] });
        this.account = res.account;
        this.isSignedIn = !!this.account;
        return this.account;
      } catch (e) {
        log('login failed', e);
        throw e;
      }
    },
    async signOut() {
      if (!this.client || !this.account) return;
      await this.client.logoutPopup({ account: this.account });
      this.isSignedIn = false; this.account = null; this.token = null;
    },
    async getToken() {
      if (!this.client) await this.init();
      const request = { scopes: cfg.scopes || ['User.Read'] };
      try {
        const res = await this.client.acquireTokenSilent({ ...request, account: this.account || this.client.getAllAccounts()[0] });
        this.token = res.accessToken; return this.token;
      } catch (e) {
        log('silent token failed; using popup', e.message);
        const res = await this.client.acquireTokenPopup(request);
        this.account = res.account; this.isSignedIn = true; this.token = res.accessToken; return this.token;
      }
    },
    async graph(path, { method = 'GET', headers = {}, body } = {}) {
      const token = await this.getToken();
      const h = { 'Authorization': `Bearer ${token}`, ...headers };
      const url = `https://graph.microsoft.com/v1.0${path}`;
      const res = await fetch(url, { method, headers: h, body });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Graph ${method} ${path} -> ${res.status}: ${text}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      return res;
    },
    // AppFolder helpers
    async ensureAppFolder() {
      // AppFolder is a special container: /me/drive/special/approot
      // We'll create a subfolder with cfg.appFolderName (optional)
      const root = await this.graph('/me/drive/special/approot');
      if (!cfg.appFolderName) return root;
      // Try to get/create child folder
      const name = cfg.appFolderName;
      try {
        const existing = await this.graph(`/me/drive/special/approot/children?$filter=name eq '${name.replace(/'/g, "''")}'`);
        if (existing.value && existing.value.length) return existing.value[0];
      } catch {}
      // Create folder
      const created = await this.graph('/me/drive/special/approot/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' })
      });
      return created;
    },
    async loadJson() {
      const folder = await this.ensureAppFolder();
      const folderId = folder.id;
      const fileName = cfg.dataFileName || 'requests.json';
      // Try to find file
      const children = await this.graph(`/me/drive/items/${folderId}/children?$filter=name eq '${fileName.replace(/'/g, "''")}'`);
      if (children.value && children.value.length) {
        const file = children.value[0];
        const dl = await this.graph(`/me/drive/items/${file.id}/content`);
        const text = await dl.text();
        try { return JSON.parse(text); } catch { return null; }
      } else {
        return null; // not found
      }
    },
    async saveJson(json) {
      const folder = await this.ensureAppFolder();
      const folderId = folder.id;
      const fileName = cfg.dataFileName || 'requests.json';
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      // Simple upload: PUT /content
      const res = await this.graph(`/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: blob
      });
      return res;
    }
  };

  window.OneDriveDB = api;
})();
