export class LruSet<K> {
  private readonly map = new Map<K, true>();

  touch(key: K) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, true);
  }

  delete(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  keysOldestFirst(): K[] {
    return Array.from(this.map.keys());
  }
}

