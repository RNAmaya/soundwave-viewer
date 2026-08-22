const DB_NAME = "soundviewer";
const STORE = "session";
const KEY = "last";
const DB_VERSION = 1;

export interface SavedSession {
  audioBlob: Blob | null;
  audioName: string | null;
  transcriptText: string | null;
  transcriptName: string | null;
  offset: number;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(session: SavedSession): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(session, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn("No se pudo guardar la sesión:", err);
  }
}

export async function loadSession(): Promise<SavedSession | null> {
  try {
    const db = await openDb();
    const value = await new Promise<SavedSession | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result as SavedSession | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();
    return value ?? null;
  } catch (err) {
    console.warn("No se pudo leer la sesión guardada:", err);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {}
}
