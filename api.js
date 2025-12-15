const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  // some endpoints might return empty
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return null;
}

export const api = {
  getActiveStore: (telegram_user_id) =>
    request(`/user_stores/active?telegram_user_id=${telegram_user_id}`),

  listProducts: (store_id) =>
    request(`/products?store_id=${store_id}`),

  topProducts: (store_id, limit = 60) =>
    request(`/pos/top?store_id=${store_id}&limit=${limit}`),

  createSale: (payload) =>
    request(`/pos/sale`, { method: "POST", body: JSON.stringify(payload) }),
};
