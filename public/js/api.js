const TOKEN_KEY = 'lb_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),

  requirements: () => request('/requirements'),
  requirement: (id) => request(`/requirements/${id}`),
  postRequirement: (body) => request('/requirements', { method: 'POST', body }),
  markTransit: (id) => request(`/requirements/${id}/transit`, { method: 'POST' }),
  markDelivered: (id) => request(`/requirements/${id}/deliver`, { method: 'POST' }),

  bids: (reqId) => request(`/requirements/${reqId}/bids`),
  placeBid: (reqId, body) => request(`/requirements/${reqId}/bids`, { method: 'POST', body }),
  awardBid: (bidId) => request(`/bids/${bidId}/award`, { method: 'POST' }),
  myBids: () => request('/bids/mine'),

  messages: (reqId) => request(`/requirements/${reqId}/messages`),
  sendMessage: (reqId, text) => request(`/requirements/${reqId}/messages`, { method: 'POST', body: { text } }),

  documents: (reqId) => request(`/requirements/${reqId}/documents`),
  uploadDocument: (reqId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/requirements/${reqId}/documents`, { method: 'POST', body: fd, isForm: true });
  },
  documentDownloadUrl: (reqId, docId) => `/api/requirements/${reqId}/documents/${docId}/download`,

  adminOverview: () => request('/admin/overview'),
  adminRegistrations: () => request('/admin/registrations'),
  approveRegistration: (id) => request(`/admin/registrations/${id}/approve`, { method: 'POST' }),
  rejectRegistration: (id) => request(`/admin/registrations/${id}/reject`, { method: 'POST' }),
  adminMembers: () => request('/admin/members'),
  adminTickets: () => request('/admin/tickets'),
  resolveTicket: (id) => request(`/admin/tickets/${id}/resolve`, { method: 'POST' }),

  openTicket: (subject) => request('/support/tickets', { method: 'POST', body: { subject } }),
};

export { ApiError };
