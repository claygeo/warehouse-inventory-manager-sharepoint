// src/utils/graphClient.js
import axios from 'axios';
import { getAccessToken } from './authProvider';
import { graphConfig } from './authConfig';

const graphApiBase = 'https://graph.microsoft.com/v1.0';

async function callGraphApi(endpoint, method = 'GET', data = null) {
  const token = await getAccessToken();
  const config = {
    method,
    url: `${graphApiBase}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data,
  };
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Graph API error:', error.response?.data || error);
    throw error;
  }
}

export async function fetchComponents() {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.components}/workbook/tables/ComponentsTable/rows`;
  const data = await callGraphApi(endpoint);
  return data.value.map((row) => ({
    id: row.values[0][0],
    barcode: row.values[0][1],
    description: row.values[0][2],
    mtd_quantity: row.values[0][3],
    ftp_quantity: row.values[0][4],
    hstd_quantity: row.values[0][5],
    '3pl_quantity': row.values[0][6],
    total_quantity: row.values[0][7],
    quarantine_quantity: row.values[0][8],
  }));
}

export async function fetchCountHistory(filter = {}) {
  let endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.countHistory}/workbook/tables/CountHistoryTable/rows`;
  if (Object.keys(filter).length > 0) {
    const filterStr = Object.entries(filter)
      .map(([key, value]) => `${key} eq '${value}'`)
      .join(' and ');
    endpoint += `?$filter=${encodeURIComponent(filterStr)}`;
  }
  const data = await callGraphApi(endpoint);
  return data.value.map((row) => ({
    id: row.values[0][0],
    sku: row.values[0][1],
    quantity: row.values[0][2],
    count_type: row.values[0][3],
    count_session: row.values[0][4],
    timestamp: row.values[0][5],
    user_type: row.values[0][6],
    source: row.values[0][7],
    location: row.values[0][8],
  }));
}

export async function fetchCycleCounts(cycleId, location) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.cycleCounts}/workbook/tables/CycleCountsTable/rows?$filter=id eq '${cycleId}' and location eq '${location}' and user_type eq 'user'`;
  const data = await callGraphApi(endpoint);
  return data.value.length > 0
    ? {
        id: data.value[0].values[0][0],
        start_date: data.value[0].values[0][1],
        last_updated: data.value[0].values[0][2],
        progress: JSON.parse(data.value[0].values[0][3] || '{}'),
        completed: data.value[0].values[0][4] === 'TRUE',
        user_type: data.value[0].values[0][5],
        location: data.value[0].values[0][6],
      }
    : null;
}

export async function fetchWeeklyCountsHstd(location) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.weeklyCountsHstd}/workbook/tables/WeeklyCountsHstdTable/rows?$filter=location eq '${location}'`;
  const data = await callGraphApi(endpoint);
  return data.value.map((row) => ({
    id: row.values[0][0],
    date: row.values[0][1],
    last_updated: row.values[0][2],
    progress: JSON.parse(row.values[0][3] || '{}'),
    day: row.values[0][4],
    completed: row.values[0][5] === 'TRUE',
    location: row.values[0][6],
  }));
}

export async function fetchHighVolumeSkus(day) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.highVolumeSkus}/workbook/tables/HighVolumeSkusTable/rows?$filter=day eq '${day}' and location eq 'HSTD'`;
  const data = await callGraphApi(endpoint);
  return data.value.map((row) => row.values[0][1]); // sku column
}

export async function fetchUserSessions() {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.userSessions}/workbook/tables/UserSessionsTable/rows`;
  const data = await callGraphApi(endpoint);
  return data.value.map((row) => ({
    id: row.values[0][0],
    user_id: row.values[0][1],
    location: row.values[0][2],
    created_at: row.values[0][3],
    user_type: 'user', // Assume user for simplicity; update with group check if needed
  }));
}

export async function insertCountHistory(record) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.countHistory}/workbook/tables/CountHistoryTable/rows/add`;
  const row = [
    crypto.randomUUID(),
    record.sku,
    record.quantity,
    record.count_type,
    record.count_session,
    record.timestamp,
    record.user_type,
    record.source,
    record.location,
  ];
  await callGraphApi(endpoint, 'POST', { values: [row] });
}

export async function upsertCycleCounts(record) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.cycleCounts}/workbook/tables/CycleCountsTable/rows/add`;
  const row = [
    record.id,
    record.start_date,
    record.last_updated,
    JSON.stringify(record.progress),
    record.completed ? 'TRUE' : 'FALSE',
    record.user_type,
    record.location,
  ];
  await callGraphApi(endpoint, 'POST', { values: [row] });
}

export async function upsertWeeklyCountsHstd(record) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.weeklyCountsHstd}/workbook/tables/WeeklyCountsHstdTable/rows/add`;
  const row = [
    record.id,
    record.date,
    record.last_updated,
    JSON.stringify(record.progress),
    record.day,
    record.completed ? 'TRUE' : 'FALSE',
    record.location,
  ];
  await callGraphApi(endpoint, 'POST', { values: [row] });
}

export async function insertUserSession(record) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.userSessions}/workbook/tables/UserSessionsTable/rows/add`;
  const row = [crypto.randomUUID(), record.user_id, record.location, record.created_at];
  await callGraphApi(endpoint, 'POST', { values: [row] });
}

export async function updateComponent(barcode, updates) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.components}/workbook/tables/ComponentsTable/rows`;
  const data = await callGraphApi(endpoint);
  const rowIndex = data.value.findIndex((row) => row.values[0][1] === barcode);
  if (rowIndex === -1) {
    const newRow = [
      crypto.randomUUID(),
      barcode,
      updates.description || '',
      updates.mtd_quantity || 0,
      updates.ftp_quantity || 0,
      updates.hstd_quantity || 0,
      updates['3pl_quantity'] || 0,
      updates.total_quantity || 0,
      updates.quarantine_quantity || 0,
    ];
    await callGraphApi(`${endpoint}/add`, 'POST', { values: [newRow] });
  } else {
    const row = data.value[rowIndex].values[0];
    const updatedRow = [
      row[0],
      barcode,
      updates.description || row[2],
      updates.mtd_quantity !== undefined ? updates.mtd_quantity : row[3],
      updates.ftp_quantity !== undefined ? updates.ftp_quantity : row[4],
      updates.hstd_quantity !== undefined ? updates.hstd_quantity : row[5],
      updates['3pl_quantity'] !== undefined ? updates['3pl_quantity'] : row[6],
      updates.total_quantity !== undefined ? updates.total_quantity : row[7],
      updates.quarantine_quantity !== undefined ? updates.quarantine_quantity : row[8],
    ];
    await callGraphApi(`${endpoint}/itemAt(index=${rowIndex})`, 'PATCH', { values: [updatedRow] });
  }
}

export async function deleteCycleCount(cycleId, location) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.cycleCounts}/workbook/tables/CycleCountsTable/rows`;
  const data = await callGraphApi(endpoint);
  const rowIndex = data.value.findIndex((row) => row.values[0][0] === cycleId && row.values[0][6] === location);
  if (rowIndex !== -1) {
    await callGraphApi(`${endpoint}/itemAt(index=${rowIndex})`, 'DELETE');
  }
}

export async function deleteWeeklyCount(weeklyId) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.weeklyCountsHstd}/workbook/tables/WeeklyCountsHstdTable/rows`;
  const data = await callGraphApi(endpoint);
  const rowIndex = data.value.findIndex((row) => row.values[0][0] === weeklyId);
  if (rowIndex !== -1) {
    await callGraphApi(`${endpoint}/itemAt(index=${rowIndex})`, 'DELETE');
  }
}

export async function deleteCountHistory(sku, startDate, endDate, location) {
  const endpoint = `/sites/${graphConfig.siteId}/drive/items/${graphConfig.fileIds.countHistory}/workbook/tables/CountHistoryTable/rows`;
  const data = await callGraphApi(endpoint);
  const rowsToDelete = data.value.filter((row) => {
    const rowSku = row.values[0][1];
    const rowTimestamp = row.values[0][5];
    const rowLocation = row.values[0][8];
    return rowSku === sku && rowLocation === location && rowTimestamp >= startDate && rowTimestamp <= endDate;
  });
  for (const row of rowsToDelete) {
    const rowIndex = data.value.indexOf(row);
    await callGraphApi(`${endpoint}/itemAt(index=${rowIndex})`, 'DELETE');
  }
}