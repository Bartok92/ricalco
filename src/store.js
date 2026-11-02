// Archivio chiave/valore su IndexedDB, con ripiego in memoria se non disponibile.
// Safari può chiudere la connessione quando l'app va in background: in quel caso
// si riapre e si riprova una volta.

const DB_NAME = 'ricalco';
const STORE = 'kv';
const memory = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB bloccato'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

async function run(mode, action) {
  for (let attempt = 0; ; attempt++) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('transazione annullata'));
      });
    } catch (e) {
      dbPromise = null;
      if (attempt >= 1) throw e;
    }
  }
}

export async function get(key) {
  try {
    const v = await run('readonly', (s) => s.get(key));
    return v === undefined ? memory.get(key) : v;
  } catch {
    return memory.get(key);
  }
}

export async function set(key, value) {
  memory.set(key, value);
  try {
    await run('readwrite', (s) => s.put(value, key));
  } catch {
    // resta in memoria per questa sessione
  }
}

export async function del(key) {
  memory.delete(key);
  try {
    await run('readwrite', (s) => s.delete(key));
  } catch {
    // ignora
  }
}
