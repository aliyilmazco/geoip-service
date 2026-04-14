type CacheRecord<Value> = {
  value: Value;
  expiresAt: number;
};

export class TtlCache<Key, Value> {
  private readonly records = new Map<Key, CacheRecord<Value>>();

  get(key: Key): Value | undefined {
    const record = this.records.get(key);

    if (!record) {
      return undefined;
    }

    if (record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return undefined;
    }

    return record.value;
  }

  set(key: Key, value: Value, ttlMs: number) {
    this.records.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clearExpired() {
    const now = Date.now();

    this.records.forEach((record, key) => {
      if (record.expiresAt <= now) {
        this.records.delete(key);
      }
    });
  }
}
