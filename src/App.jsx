import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, onSnapshot,
  collection, addDoc, query, deleteDoc, orderBy
} from 'firebase/firestore';
import {
  Package, Plus, Trash2, Edit2, Cloud, Loader2, CheckCircle,
  MessageCircle, History, X, RotateCcw, Save,
  ClipboardList, Star, ChevronDown, ChevronUp, Camera
} from 'lucide-react';

const firebaseConfig = typeof import.meta.env.VITE_FIREBASE_CONFIG !== 'undefined'
  ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG)
  : { apiKey: "AIzaSyC1nY16Syzk94PC7KcwrI_Y3IzY7v5bKzs", authDomain: "guinus-app.firebaseapp.com", projectId: "guinus-app", storageBucket: "guinus-app.firebasestorage.app", messagingSenderId: "180715341971", appId: "1:180715341971:web:48bf14583a085f4799e566" };

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const APP_ID = 'guinus-orders-v1';

const compressImage = (file) =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const MAX = 220;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = URL.createObjectURL(file);
  });

// ── PRODUCT FORM MODAL ─────────────────────────────────────────────────────────
const ProductForm = ({ product, onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', price: '', photo: '', ...product });
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (file) setForm(f => ({ ...f, photo: '' })) || setTimeout(async () => {
      const compressed = await compressImage(file);
      setForm(f => ({ ...f, photo: compressed }));
    }, 0);
    const compressed = await compressImage(file);
    setForm(f => ({ ...f, photo: compressed }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#1a1c20] rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-sm border border-slate-700 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-black text-xl text-white">{product?.id ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={22} /></button>
        </div>

        {/* Photo picker */}
        <div className="flex justify-center mb-5">
          <div
            className="w-28 h-28 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
            onClick={() => fileRef.current?.click()}
          >
            {form.photo ? (
              <>
                <img src={form.photo} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={24} className="text-white" />
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500">
                <Camera size={28} className="mx-auto mb-1" />
                <span className="text-xs font-bold">Foto</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Nombre *</label>
            <input
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej. Coca-Cola 1L"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Precio por unidad (€)</label>
            <input
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl bg-slate-800 text-slate-400 font-black text-sm hover:bg-slate-700 transition-all">
            Cancelar
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim()}
            className="flex-1 py-3.5 rounded-xl bg-yellow-500 text-slate-900 font-black text-sm hover:bg-yellow-400 transition-all disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MAIN APP ───────────────────────────────────────────────────────────────────
const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('pedido');
  const [saveStatus, setSaveStatus] = useState('idle');

  // Catalog state
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Order state
  const [orderLines, setOrderLines] = useState({});
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderNotes, setOrderNotes] = useState('');
  const [suggestions, setSuggestions] = useState({});

  // History state
  const [orders, setOrders] = useState([]);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // ── AUTH ──
  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error(e); }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // ── LOAD CATALOG ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'catalog'));
    return onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setProducts(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });
  }, [user]);

  // ── LOAD ORDERS + COMPUTE SUGGESTIONS ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', APP_ID, 'users', user.uid, 'orders'),
      orderBy('date', 'desc')
    );
    return onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setOrders(list);

      // Average quantities from last 3 orders
      const last3 = list.slice(0, 3);
      const sug = {};
      if (last3.length > 0) {
        const allIds = new Set(last3.flatMap(o => Object.keys(o.lines || {})));
        allIds.forEach(pid => {
          const qtys = last3.map(o => o.lines?.[pid] || 0).filter(q => q > 0);
          if (qtys.length > 0) sug[pid] = Math.ceil(qtys.reduce((a, b) => a + b, 0) / qtys.length);
        });
      }
      setSuggestions(sug);
    });
  }, [user]);

  // ── CATALOG CRUD ──
  const saveProduct = async (prod) => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      const data = { name: prod.name.trim(), price: parseFloat(prod.price) || 0, photo: prod.photo || '' };
      if (prod.id) {
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'catalog', prod.id), data, { merge: true });
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'catalog'), { ...data, createdAt: new Date().toISOString() });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setShowForm(false);
      setEditingProduct(null);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  const deleteProduct = async (id) => {
    if (!user || !window.confirm('¿Eliminar este producto del catálogo?')) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'catalog', id));
  };

  // ── ORDER HELPERS ──
  const setQty = (pid, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    setOrderLines(prev => ({ ...prev, [pid]: n }));
  };

  const applySuggestions = () => {
    setOrderLines(prev => {
      const next = { ...prev };
      Object.entries(suggestions).forEach(([pid, qty]) => {
        if (!next[pid]) next[pid] = qty;
      });
      return next;
    });
  };

  const clearOrder = () => { setOrderLines({}); setOrderNotes(''); };

  const activeLines = Object.entries(orderLines).filter(([, q]) => q > 0);
  const orderTotal = activeLines.reduce((sum, [pid, qty]) => {
    return sum + (products.find(p => p.id === pid)?.price || 0) * qty;
  }, 0);

  // ── SAVE ORDER ──
  const saveOrder = async () => {
    if (!user || activeLines.length === 0) return;
    setSaveStatus('saving');
    try {
      const snapshot = products.reduce((acc, p) => {
        acc[p.id] = { name: p.name, price: p.price, photo: p.photo };
        return acc;
      }, {});
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'orders'), {
        date: orderDate,
        lines: Object.fromEntries(activeLines),
        notes: orderNotes,
        products: snapshot,
        createdAt: new Date().toISOString(),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      clearOrder();
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  // ── WHATSAPP ──
  const sendWhatsApp = () => {
    if (activeLines.length === 0) return;
    const dateFmt = new Date(orderDate + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const body = activeLines.map(([pid, qty]) => {
      const p = products.find(x => x.id === pid);
      return `• ${p?.name || pid} x ${qty} ud`;
    }).join('\n');
    const text = `🛒 *PEDIDO GUIÑUS – ${dateFmt}*\n\n${body}\n\n💰 *Total aprox: ${orderTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€*${orderNotes ? `\n\n📝 ${orderNotes}` : ''}`;

    navigator.clipboard.writeText(text)
      .then(() => alert('✅ Copiado al portapapeles. Pégalo en WhatsApp.'))
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert('✅ Copiado al portapapeles. Pégalo en WhatsApp.');
      });
  };

  // ── SHARED HEADER ──
  const Header = () => (
    <header className="bg-[#0d0e10] px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
      <span className="text-2xl font-black text-yellow-500 italic tracking-tighter select-none">GUIÑUS</span>
      <nav className="flex bg-slate-900 rounded-2xl p-1 gap-0.5">
        {[
          { id: 'pedido', icon: ClipboardList, label: 'Pedido' },
          { id: 'catalogo', icon: Package, label: 'Catálogo' },
          { id: 'historial', icon: History, label: 'Historial' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${view === id ? 'bg-yellow-500 text-slate-900' : 'text-slate-500 hover:text-white'}`}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </nav>
      <div className="w-8 flex justify-center">
        {saveStatus === 'saving' && <Loader2 size={15} className="text-blue-400 animate-spin" />}
        {saveStatus === 'saved' && <CheckCircle size={15} className="text-emerald-400" />}
        {saveStatus === 'idle' && <Cloud size={15} className="text-slate-700" />}
      </div>
    </header>
  );

  // ══ VIEW: PEDIDO ══════════════════════════════════════════════════════════════
  if (view === 'pedido') {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-white font-sans flex flex-col">
        <Header />

        <div className="flex-1 p-4 max-w-xl mx-auto w-full" style={{ paddingBottom: activeLines.length > 0 ? '9rem' : '2rem' }}>

          {/* Date + notes */}
          <div className="bg-[#141618] rounded-2xl p-4 mb-4 border border-slate-800 flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-widest">Fecha</label>
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-widest">Notas</label>
              <input
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Urgente, observaciones..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-sm placeholder:text-slate-700 focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          {/* Suggestions banner */}
          {Object.keys(suggestions).length > 0 && (
            <button
              onClick={applySuggestions}
              className="w-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 rounded-2xl p-3 mb-4 flex items-center gap-3 hover:bg-indigo-950 transition-colors text-sm font-bold"
            >
              <Star size={15} className="text-indigo-400 flex-shrink-0" />
              <span>Aplicar sugerencias del historial</span>
              <span className="ml-auto text-[10px] text-indigo-600 hidden sm:block">últimos 3 pedidos</span>
            </button>
          )}

          {/* Product list */}
          {products.length === 0 ? (
            <div className="text-center py-20 text-slate-700">
              <Package size={52} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold text-lg mb-1 text-slate-500">Sin productos</p>
              <p className="text-sm mb-5">Añade productos al catálogo primero</p>
              <button onClick={() => setView('catalogo')} className="bg-yellow-500 text-slate-900 px-6 py-3 rounded-xl font-black text-sm hover:bg-yellow-400">
                Ir al Catálogo →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(prod => {
                const qty = orderLines[prod.id] || 0;
                const sug = suggestions[prod.id];
                const active = qty > 0;
                return (
                  <div
                    key={prod.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${active ? 'bg-yellow-500/10 border-yellow-500/25' : 'bg-[#141618] border-slate-800'}`}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
                      {prod.photo
                        ? <img src={prod.photo} alt={prod.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-slate-600" /></div>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-sm truncate ${active ? 'text-white' : 'text-slate-300'}`}>{prod.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-slate-600 font-bold">
                          {prod.price?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€/ud
                        </span>
                        {sug && qty === 0 && (
                          <span className="text-[10px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded-full font-bold border border-indigo-800/50">
                            💡 {sug} sugerido
                          </span>
                        )}
                        {active && (
                          <span className="text-[11px] text-yellow-400 font-black">
                            = {((prod.price || 0) * qty).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setQty(prod.id, qty - 1)}
                        className={`w-8 h-8 rounded-lg font-black text-base flex items-center justify-center transition-all select-none ${qty > 0 ? 'bg-yellow-500 text-slate-900' : 'bg-slate-800 text-slate-600'}`}
                      >−</button>
                      <input
                        type="number"
                        value={qty || ''}
                        onChange={e => setQty(prod.id, e.target.value)}
                        placeholder="0"
                        className="w-11 text-center bg-slate-900 border border-slate-700 rounded-lg py-1.5 font-black text-sm text-white focus:outline-none focus:border-yellow-500"
                      />
                      <button
                        onClick={() => setQty(prod.id, qty + 1)}
                        className="w-8 h-8 rounded-lg bg-yellow-500 text-slate-900 font-black text-base flex items-center justify-center select-none hover:bg-yellow-400 transition-all"
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        {activeLines.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#0d0e10]/95 backdrop-blur border-t border-slate-800 p-4 z-30">
            <div className="max-w-xl mx-auto">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[10px] text-slate-600 font-black uppercase">{activeLines.length} productos · {activeLines.reduce((s, [, q]) => s + q, 0)} unidades</p>
                  <p className="text-3xl font-black text-yellow-500 tracking-tighter leading-none mt-0.5">
                    {orderTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </p>
                </div>
                <button onClick={clearOrder} className="text-slate-700 hover:text-slate-400 flex items-center gap-1.5 text-xs font-bold pb-1">
                  <RotateCcw size={13} /> Limpiar
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={saveOrder}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-2xl font-black text-sm transition-all border border-slate-700"
                >
                  <Save size={15} /> Guardar
                </button>
                <button
                  onClick={sendWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-2xl font-black text-sm transition-all"
                >
                  <MessageCircle size={15} /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══ VIEW: CATÁLOGO ════════════════════════════════════════════════════════════
  if (view === 'catalogo') {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-white font-sans">
        <Header />
        <div className="p-4 max-w-xl mx-auto pb-10">
          <div className="flex justify-between items-center my-5">
            <div>
              <h2 className="text-2xl font-black text-white">Catálogo</h2>
              <p className="text-xs text-slate-600 font-bold mt-0.5">{products.length} productos</p>
            </div>
            <button
              onClick={() => { setEditingProduct({}); setShowForm(true); }}
              className="flex items-center gap-2 bg-yellow-500 text-slate-900 px-5 py-2.5 rounded-xl font-black text-sm hover:bg-yellow-400 transition-all"
            >
              <Plus size={15} /> Añadir
            </button>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20 text-slate-700">
              <Package size={56} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold text-lg text-slate-500 mb-1">Catálogo vacío</p>
              <p className="text-sm">Añade tus productos para empezar</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map(prod => (
                <div key={prod.id} className="bg-[#141618] rounded-2xl border border-slate-800 overflow-hidden group">
                  <div className="aspect-square bg-slate-900 relative overflow-hidden">
                    {prod.photo
                      ? <img src={prod.photo} alt={prod.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package size={36} className="text-slate-700" /></div>}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => { setEditingProduct(prod); setShowForm(true); }}
                        className="bg-white text-slate-900 p-2.5 rounded-xl hover:bg-yellow-400 transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => deleteProduct(prod.id)}
                        className="bg-red-600 text-white p-2.5 rounded-xl hover:bg-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-black text-sm text-white truncate">{prod.name}</p>
                    <p className="text-yellow-500 font-black text-sm mt-0.5">
                      {prod.price?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <ProductForm
            product={editingProduct}
            onSave={saveProduct}
            onClose={() => { setShowForm(false); setEditingProduct(null); }}
          />
        )}
      </div>
    );
  }

  // ══ VIEW: HISTORIAL ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white font-sans">
      <Header />
      <div className="p-4 max-w-xl mx-auto pb-10">
        <div className="my-5">
          <h2 className="text-2xl font-black text-white">Historial</h2>
          <p className="text-xs text-slate-600 font-bold mt-0.5">{orders.length} pedidos guardados</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 text-slate-700">
            <History size={56} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg text-slate-500 mb-1">Sin pedidos aún</p>
            <p className="text-sm">Guarda un pedido y aparecerá aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const totalUnits = Object.values(order.lines || {}).reduce((a, b) => a + b, 0);
              const totalPrice = Object.entries(order.lines || {}).reduce((sum, [pid, qty]) => {
                const info = order.products?.[pid] || products.find(p => p.id === pid);
                return sum + (info?.price || 0) * qty;
              }, 0);
              const isExpanded = expandedOrder === order.id;
              const dateFmt = order.date
                ? new Date(order.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                : '---';

              return (
                <div key={order.id} className="bg-[#141618] rounded-2xl border border-slate-800 overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-800/30 transition-colors"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-700">
                      <ClipboardList size={17} className="text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm capitalize">{dateFmt}</p>
                      <p className="text-[11px] text-slate-600 font-bold mt-0.5">
                        {totalUnits} uds · {totalPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                      </p>
                    </div>
                    {isExpanded
                      ? <ChevronUp size={17} className="text-slate-600 flex-shrink-0" />
                      : <ChevronDown size={17} className="text-slate-600 flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-800 px-4 pb-4 pt-3">
                      {order.notes && (
                        <p className="text-xs text-slate-500 italic mb-3 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
                          📝 {order.notes}
                        </p>
                      )}
                      <div className="space-y-2 mb-4">
                        {Object.entries(order.lines || {}).map(([pid, qty]) => {
                          const info = order.products?.[pid] || products.find(p => p.id === pid);
                          return (
                            <div key={pid} className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 border border-slate-800">
                                {info?.photo
                                  ? <img src={info.photo} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-slate-700" /></div>}
                              </div>
                              <span className="flex-1 text-sm text-slate-300 font-bold truncate">{info?.name || pid}</span>
                              <span className="text-sm font-black text-yellow-500 flex-shrink-0">× {qty}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => { setOrderLines({ ...order.lines }); setView('pedido'); }}
                        className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all border border-yellow-500/20"
                      >
                        Usar como base para nuevo pedido
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
