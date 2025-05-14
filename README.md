## Warehouse Inventory Manager (SharePoint)

A React-based web application for inventory management, integrated with Microsoft SharePoint via MSAL.js and the Microsoft Graph API. It supports weekly and monthly cycle counts, audit trails, and analytics dashboards, with a user-friendly interface for warehouse operations.

## Table of Contents 
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Sharepoint Setup](#sharepoint-setup)
- [Steps](#steps)
- [Permissions](#permissions)
- [Visuals](#visuals)
- [Notes](#notes)
  
## Features
- Microsoft 365 Authentication: Secure login using MSAL.js with Microsoft 365 credentials, supporting admin and user roles.
-  Cycle Counts:
    - Weekly Counts: High-volume SKU counts for HSTD location, with progress tracking and conflict detection.
    - Monthly Counts: Comprehensive cycle counts across MtD, FtP, HSTD, and 3PL locations, with admin and user views.
- Audit Trails: Logs for login, location selection, and count events, stored in SharePoint Excel files.
- Analytics Dashboard: Visual charts for inventory data, with refresh functionality.
- SharePoint Integration: Data storage and retrieval from Excel files (components.xlsx, cycle_counts.xlsx, weekly_counts_hstd.xlsx, count_history.xlsx, high_volume_skus.xlsx, user_sessions.xlsx) via Graph API.
- Tailwind CSS: Polished, responsive UI with Curaleaf branding.
- Offline Support: Minimal offline capabilities (authentication requires online access).

## Prerequisites
- Node.js and npm: Version 20.x or later recommended.
- Microsoft 365 Account: Access to a tenant with SharePoint Online.
- Azure AD App Registration:
    - Client ID for Single Page Application (SPA).
    - Redirect URI set to http://localhost:3000 (development).
    - Permissions: User.Read, Sites.ReadWrite.All.
- SharePoint Site: A site (e.g., InventoryTracker) with a document library containing the required Excel files.
- Git: For cloning the repository.

## Setup
1. Clone the Repository: git clone https://github.com/claygeo/warehouse-inventory-manager-sharepoint.git
cd warehouse-inventory-manager-sharepoint

2. Install Dependencies: npm install

3. Configure Authentication and SharePoint:
- Create or edit src/utils/authConfig.js with your Azure AD and SharePoint details: export const msalConfig = {
  auth: {
    clientId: 'YOUR_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const graphConfig = {
  siteId: 'YOUR_SITE_ID',
  fileIds: {
    components: 'YOUR_COMPONENTS_FILE_ID',
    countHistory: 'YOUR_COUNT_HISTORY_FILE_ID',
    cycleCounts: 'YOUR_CYCLE_COUNTS_FILE_ID',
    weeklyCountsHstd: 'YOUR_WEEKLY_COUNTS_HSTD_FILE_ID',
    highVolumeSkus: 'YOUR_HIGH_VOLUME_SKUS_FILE_ID',
    userSessions: 'YOUR_USER_SESSIONS_FILE_ID',
  },
};


- Obtain details from your IT team:
    - Tenant ID: Microsoft 365 tenant ID (GUID, e.g., 123e4567-e89b-12d3-a456-426614174000).
    - Client ID: From Azure AD app registration.
    - Site ID: From SharePoint site URL (e.g., yourtenant.sharepoint.com,guid1,guid2).
    - File IDs: Document IDs from SharePoint for each Excel file.
      
4. Start the App: npm start
    - The app runs at http://localhost:3000.

5. Build for Production (Optional): npm run build
    - Output is in the build/ directory.

## Sharepoint Setup
The application uses SharePoint Excel files for data storage, accessed via the Microsoft Graph API. Ensure the following Excel files are set up in a SharePoint document library with named tables:

1. components.xlsx:

Table: ComponentsTable
Columns: id, barcode, description, mtd_quantity, ftp_quantity, hstd_quantity, 3pl_quantity, total_quantity, quarantine_quantity


2. count_history.xlsx:

Table: CountHistoryTable
Columns: id, sku, quantity, count_type, count_session, timestamp, user_type, source, location


3. cycle_counts.xlsx:

Table: CycleCountsTable
Columns: id, start_date, last_updated, progress, completed, user_type, location


4. weekly_counts_hstd.xlsx:

Table: WeeklyCountsHstdTable
Columns: id, date, last_updated, progress, day, completed, location


5. high_volume_skus.xlsx:

Table: HighVolumeSkusTable
Columns: id, sku, day, location


6. user_sessions.xlsx:

Table: UserSessionsTable
Columns: id, user_id, location, created_at

## Steps:
- Create a SharePoint site (e.g., InventoryTracker).
- Upload the Excel files to a document library.
- Ensure each file has a named table (as listed above) with the specified columns.
- Grant users “Contribute” access to the site.
- Obtain file IDs from SharePoint (right-click file > Details > Document ID or Path).
- Update authConfig.js with the site ID and file IDs.

## Permissions:

- Azure AD app must have Sites.ReadWrite.All permission.
- Users must have Microsoft 365 accounts with access to the SharePoint site.

## Visuals
The following screenshots showcase the application’s UI. Note that /generate-labels and /print-settings are currently disabled.
Login: ![image](https://github.com/user-attachments/assets/734e074e-b4b6-4275-9cd6-b4dd4be7bd3b)
Location Selection: ![image](https://github.com/user-attachments/assets/ec35bdfb-8e96-4106-b4f5-e42c046a09fb)
Main Dashboard: ![image](https://github.com/user-attachments/assets/a4b476b7-10b3-425c-aca3-626654d9883c)
Graphs: ![image](https://github.com/user-attachments/assets/9f34acb3-af25-4743-83cf-c37d3777c1da)
![image](https://github.com/user-attachments/assets/65033a0e-e631-4525-8a36-3437b06e8b2e)
![image](https://github.com/user-attachments/assets/328669df-43ce-423d-97c4-4f221d164fb5)
Monthly Count: ![image](https://github.com/user-attachments/assets/801f1a8f-d869-4ed6-8f3d-47b808d33ead)
Weekly Count: ![image](https://github.com/user-attachments/assets/64572642-ecff-4dca-bdd8-af9f3d581d71)
Audit Trails: ![image](https://github.com/user-attachments/assets/3f3d91b5-d259-4bfb-97f7-e98a114a924d)

## Notes

- Curaleaf Branding: Used with permission.
- Environment Variables: Ensure authConfig.js is updated with valid IDs and not committed with sensitive data (use .gitignore).
- Offline Support: Limited to UI rendering; authentication and data operations require an internet connection.
- PDF Generation: Disabled to focus on cycle counts. Future implementation may use Power Automate or a custom backend.

