import { seedToSpots } from './util.js';

const CACHE_KEY = 'japan-trip-spots-v1';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export function createStore({ config, tripId, seed, onChange, onStatus }) {
  let spots = [];
  let db = null;
  let fs = null;

  const emit = () => onChange(spots);
  const col = () => fs.collection(db, 'trips', tripId, 'spots');
  const docRef = id => fs.doc(db, 'trips', tripId, 'spots', id);

  function loadCache() {
    try { const j = localStorage.getItem(CACHE_KEY); if (j) spots = JSON.parse(j); } catch { /* ignore */ }
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(spots)); } catch { /* ignore */ }
  }
  function ready() { if (!db) throw new Error('尚未連線到資料庫'); }

  async function writeSeed(list) {
    const batch = fs.writeBatch(db);
    for (const s of list) batch.set(docRef(s.id), { ...s, updatedAt: fs.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  async function ensureSeeded() {
    const tripRef = fs.doc(db, 'trips', tripId);
    try {
      const won = await fs.runTransaction(db, async tx => {
        const snap = await tx.get(tripRef);
        if (snap.exists() && snap.data().seeded) return false;
        tx.set(tripRef, { seeded: true, seededAt: fs.serverTimestamp() }, { merge: true });
        return true;
      });
      if (won) await writeSeed(seedToSpots(seed));
    } catch (e) {
      console.warn('seed skipped (offline?)', e);
    }
  }

  async function connect() {
    loadCache();
    if (!spots.length) spots = seedToSpots(seed);
    emit();
    if (!config || !config.apiKey || !tripId) { onStatus('unconfigured'); return; }
    onStatus('connecting');
    try {
      const { initializeApp } = await import(FB + 'firebase-app.js');
      fs = await import(FB + 'firebase-firestore.js');
      const app = initializeApp(config);
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
    } catch (e) {
      console.error(e); onStatus('error'); return;
    }
    await ensureSeeded();
    fs.onSnapshot(col(), { includeMetadataChanges: true }, snap => {
      spots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveCache(); emit();
      onStatus(snap.metadata.fromCache ? 'offline' : 'online');
    }, err => { console.error(err); onStatus('error'); });
  }

  async function addSpot(data) {
    ready();
    const ref = fs.doc(col());
    fs.setDoc(ref, { ...data, id: ref.id, source: 'user', updatedAt: fs.serverTimestamp() }).catch(console.error);
    return ref.id;
  }
  async function updateSpot(id, data) {
    ready();
    fs.updateDoc(docRef(id), { ...data, updatedAt: fs.serverTimestamp() }).catch(console.error);
  }
  async function deleteSpot(id) {
    ready();
    fs.deleteDoc(docRef(id)).catch(console.error);
  }
  async function reorder(pairs) {
    ready();
    const batch = fs.writeBatch(db);
    for (const p of pairs) batch.update(docRef(p.id), { order: p.order });
    batch.commit().catch(console.error);
  }
  async function restoreSeed() {
    ready();
    const have = new Set(spots.map(s => s.id));
    await writeSeed(seedToSpots(seed).filter(s => !have.has(s.id)));
  }

  return { connect, isReady: () => !!db, addSpot, updateSpot, deleteSpot, reorder, restoreSeed, getSpots: () => spots };
}
