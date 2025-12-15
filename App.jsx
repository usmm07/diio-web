import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { getTg, getTelegramUserId } from "./telegram";

function formatPrice(p) {
  if (p == null) return "";
  return `${Number(p).toLocaleString("ru-RU")} сум`;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tgUserId, setTgUserId] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState({}); // productId -> qty
  const [busy, setBusy] = useState(false);

  const tg = useMemo(() => getTg(), []);

  useEffect(() => {
    // init Telegram WebApp UI
    if (tg) {
      tg.expand();
      tg.ready();
    }

    const id = getTelegramUserId();
    setTgUserId(id);

    // Local dev fallback: allow ?uid=123
    const url = new URL(window.location.href);
    const uidFromQuery = url.searchParams.get("uid");
    if (!id && uidFromQuery) setTgUserId(Number(uidFromQuery));
  }, [tg]);

  useEffect(() => {
    async function boot() {
      setErr("");
      setLoading(true);
      try {
        if (!tgUserId) throw new Error("Нет Telegram user id. Открой через Telegram или добавь ?uid=123 для теста.");
        const active = await api.getActiveStore(tgUserId);
        if (!active?.store_id) throw new Error("Нет активного магазина. Выбери магазин в боте (🏪 Мои магазины).");

        setStoreId(active.store_id);

        // Для MVP можно брать /pos/top. Если хочешь весь каталог — /products
        const top = await api.topProducts(active.store_id, 60);
        setProducts(top || []);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [tgUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name || "").toLowerCase().includes(q));
  }, [products, query]);

  const cartItems = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return Object.entries(cart)
      .map(([id, qty]) => ({ p: map.get(Number(id)), qty }))
      .filter((x) => x.p && x.qty > 0);
  }, [cart, products]);

  const totalQty = useMemo(() => cartItems.reduce((s, x) => s + Number(x.qty), 0), [cartItems]);

  function addToCart(pid) {
    setCart((c) => ({ ...c, [pid]: (c[pid] || 0) + 1 }));
  }
  function decFromCart(pid) {
    setCart((c) => {
      const next = { ...c };
      const v = (next[pid] || 0) - 1;
      if (v <= 0) delete next[pid];
      else next[pid] = v;
      return next;
    });
  }
  function clearCart() {
    setCart({});
  }

  async function checkout() {
    if (!storeId) return;
    if (cartItems.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      const payload = {
        store_id: storeId,
        telegram_user_id: tgUserId,
        items: cartItems.map(({ p, qty }) => ({
          product_id: p.id,
          qty: Number(qty),
          price: p.price ?? null
        })),
      };
      const res = await api.createSale(payload);
      clearCart();

      if (tg) {
        tg.HapticFeedback?.notificationOccurred?.("success");
        tg.showPopup?.({ title: "Готово", message: `Продажа проведена (sale_id=${res.sale_id}).`, buttons: [{ type: "ok" }] });
      } else {
        alert(`Продажа проведена (sale_id=${res.sale_id})`);
      }
    } catch (e) {
      setErr(e.message || String(e));
      if (tg) tg.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="title">Diio POS</div>
          <div className="sub">store_id: {storeId ?? "—"} • user: {tgUserId ?? "—"}</div>
        </div>
        <button className="btn ghost" onClick={() => window.location.reload()} disabled={busy}>Обновить</button>
      </header>

      {loading && <div className="card">Загрузка…</div>}
      {err && <div className="card error">{err}</div>}

      {!loading && !err && (
        <>
          <div className="card">
            <input
              className="input"
              placeholder="Поиск товара…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid">
            {filtered.map((p) => (
              <button key={p.id} className="tile" onClick={() => addToCart(p.id)} disabled={busy}>
                <div className="tileName">{p.name}</div>
                <div className="tilePrice">{formatPrice(p.price)}</div>
              </button>
            ))}
          </div>

          <div className="cart">
            <div className="cartHead">
              <div className="cartTitle">Корзина</div>
              <div className="cartMeta">{totalQty} шт</div>
            </div>

            {cartItems.length === 0 ? (
              <div className="cartEmpty">Пусто. Нажимай товары выше.</div>
            ) : (
              <div className="cartList">
                {cartItems.map(({ p, qty }) => (
                  <div key={p.id} className="cartRow">
                    <div className="cartRowName">{p.name}</div>
                    <div className="cartRowBtns">
                      <button className="btn small" onClick={() => decFromCart(p.id)} disabled={busy}>−</button>
                      <div className="qty">{qty}</div>
                      <button className="btn small" onClick={() => addToCart(p.id)} disabled={busy}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="cartActions">
              <button className="btn ghost" onClick={clearCart} disabled={busy || cartItems.length === 0}>Очистить</button>
              <button className="btn" onClick={checkout} disabled={busy || cartItems.length === 0}>
                {busy ? "Пробиваем…" : "✅ Пробить"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
