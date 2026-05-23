const DB_NAME = "nihongo_bjt_reviews";
const DB_VERSION = 1;
const STORE = "pending";

export type QueuedReview = {
  clientMutationId: string;
  elapsedMs?: number;
  rating: "again" | "hard" | "good" | "easy";
  userFlashcardId: string;
  userId: string;
};

type Stored = QueuedReview & { enqueuedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { autoIncrement: true });
      }
    };
  });
}

export async function enqueueReview(item: QueuedReview): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).add({ ...item, enqueuedAt: Date.now() } satisfies Stored);
  });
  db.close();
}

/** Removes and returns queued reviews for one learner only. */
export async function drainForUser(userId: string): Promise<QueuedReview[]> {
  const db = await openDb();
  const out: QueuedReview[] = [];
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const r = store.openCursor();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const cursor = r.result;
      if (!cursor) {
        resolve();
        return;
      }
      const row = cursor.value as Stored;
      if (row.userId === userId) {
        out.push({
          clientMutationId: row.clientMutationId,
          elapsedMs: row.elapsedMs,
          rating: row.rating,
          userFlashcardId: row.userFlashcardId,
          userId: row.userId
        });
        cursor.delete();
      }
      cursor.continue();
    };
  });
  db.close();
  return out;
}

export async function queueSizeForUser(userId: string): Promise<number> {
  const db = await openDb();
  let n = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).openCursor();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const cursor = r.result;
      if (!cursor) {
        resolve();
        return;
      }
      if ((cursor.value as Stored).userId === userId) {
        n += 1;
      }
      cursor.continue();
    };
  });
  db.close();
  return n;
}
