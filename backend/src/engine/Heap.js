// Generic Heap — MinHeap / MaxHeap with price-time priority comparator

export class Heap {
  /**
   * @param {function(a, b): number} comparator
   *   Returns negative if `a` should be above `b` in the heap (higher priority).
   */
  constructor(comparator) {
    this._data = []
    this._cmp = comparator
  }

  get size() {
    return this._data.length
  }

  isEmpty() {
    return this._data.length === 0
  }

  peek() {
    return this._data[0] ?? null
  }

  push(item) {
    this._data.push(item)
    this._bubbleUp(this._data.length - 1)
  }

  pop() {
    if (this.isEmpty()) return null
    const top = this._data[0]
    const last = this._data.pop()
    if (this._data.length > 0) {
      this._data[0] = last
      this._sinkDown(0)
    }
    return top
  }

  /**
   * Remove an item by its orderId. O(n) scan + O(log n) re-heap.
   * Returns true if found and removed.
   */
  remove(orderId) {
    const idx = this._data.findIndex(item => item.orderId === orderId)
    if (idx === -1) return false
    const last = this._data.pop()
    if (idx < this._data.length) {
      this._data[idx] = last
      this._bubbleUp(idx)
      this._sinkDown(idx)
    }
    return true
  }

  /**
   * Return a sorted snapshot (does NOT mutate the heap).
   * For bids (MaxHeap): descending price. For asks (MinHeap): ascending price.
   */
  toSorted() {
    return [...this._data].sort(this._cmp)
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this._cmp(this._data[i], this._data[parent]) < 0) {
        ;[this._data[i], this._data[parent]] = [this._data[parent], this._data[i]]
        i = parent
      } else break
    }
  }

  _sinkDown(i) {
    const n = this._data.length
    while (true) {
      let best = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this._cmp(this._data[l], this._data[best]) < 0) best = l
      if (r < n && this._cmp(this._data[r], this._data[best]) < 0) best = r
      if (best === i) break
      ;[this._data[i], this._data[best]] = [this._data[best], this._data[i]]
      i = best
    }
  }
}

/**
 * Price-Time priority comparator factories.
 * - MaxHeap (bids):  highest price first; ties → earliest timestamp first
 * - MinHeap (asks):  lowest  price first; ties → earliest timestamp first
 */
function bidComparator(a, b) {
  if (Number(b.price) !== Number(a.price)) return Number(b.price) - Number(a.price)
  return a.timestamp - b.timestamp
}

function askComparator(a, b) {
  if (Number(a.price) !== Number(b.price)) return Number(a.price) - Number(b.price)
  return a.timestamp - b.timestamp
}

export class MaxHeap extends Heap {
  constructor() { super(bidComparator) }
}

export class MinHeap extends Heap {
  constructor() { super(askComparator) }
}
