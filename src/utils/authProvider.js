// src/utils/authProvider.js
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './authConfig';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL instance (call once at module load)
let isInitialized = false;
const initializeMsal = async () => {
  if (!isInitialized) {
    await msalInstance.initialize();
    isInitialized = true;
  }
};

export async function login() {
  try {
    await initializeMsal();
    const loginResponse = await msalInstance.loginPopup({
      scopes: ['User.Read', 'Sites.ReadWrite.All'],
    });
    msalInstance.setActiveAccount(loginResponse.account);
    return loginResponse.account;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function getAccessToken() {
  await initializeMsal();
  const account = msalInstance.getActiveAccount();
  if (!account) {
    throw new Error('No active account');
  }
  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: ['User.Read', 'Sites.ReadWrite.All'],
      account,
    });
    return response.accessToken;
  } catch (error) {
    console.error('Token acquisition error:', error);
    try {
      const response = await msalInstance.acquireTokenPopup({
        scopes: ['User.Read', 'Sites.ReadWrite.All'],
      });
      return response.accessToken;
    } catch (popupError) {
      console.error('Popup token error:', popupError);
      throw popupError;
    }
  }
}

export async function getCurrentUser() {
  await initializeMsal();
  const account = msalInstance.getActiveAccount();
  if (!account) {
    return null;
  }
  return {
    id: account.localAccountId,
    email: account.username,
    name: account.name,
  };
}

export async function logout() {
  try {
    await initializeMsal();
    const account = msalInstance.getActiveAccount();
    if (account) {
      await msalInstance.logoutPopup({ account });
      msalInstance.setActiveAccount(null);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}