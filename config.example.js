// Copy this file to config.js and fill in your Azure App Registration details.
// This config is used by onedrive.js (MSAL + Microsoft Graph)

window.OneDriveConfig = {
  msal: {
    clientId: "YOUR_AZURE_APP_CLIENT_ID",
    authority: "https://login.microsoftonline.com/common", // or your tenant ID
    redirectUri: window.location.origin + (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname.replace(/[^/]+$/, ''))
  },
  scopes: ["User.Read", "Files.ReadWrite.AppFolder"],
  appFolderName: "Ln", // we'll create/use this under the App Folder
  // File path within the app folder
  dataFileName: "requests.json"
};
