// src/utils/authConfig.js
export const msalConfig = {
  auth: {
    clientId: 'YOUR_CLIENT_ID', // Replace with Azure AD app client ID
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID', // Replace with tenant ID
    redirectUri: window.location.origin, // e.g., http://localhost:3000 for development
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const graphConfig = {
  siteId: 'YOUR_SITE_ID', // Replace with SharePoint site ID (e.g., 'yourtenant.sharepoint.com,guid1,guid2')
  fileIds: {
    components: 'components.xlsx', //
    countHistory: 'CountHistory.xlsx', // 
    cycleCounts: 'CycleCounts.xlsx', // Replace with cycle_counts.xlsx file ID
    weeklyCountsHstd: 'WeeklyCountsHSTD.xlsx', // Replace with weekly_counts_hstd.xlsx file ID
    highVolumeSkus: 'HighVolumeSkus.xlsx', // Replace with high_volume_skus.xlsx file ID
    userSessions: 'UserSessions.xlsx', // Replace with user_sessions.xlsx file ID
  },
};