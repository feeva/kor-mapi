/**
 * Maps opaque integer handle IDs to native provider objects.
 * Each adapter maintains its own registries for markers, overlays, etc.
 */
export class HandleRegistry<T> {
  private readonly map = new Map<number, T>();
  private counter = 0;

  register(value: T): number {
    const id = ++this.counter;
    this.map.set(id, value);
    return id;
  }

  get(id: number): T {
    const value = this.map.get(id);
    if (value === undefined) throw new Error(`Handle ${id} not found in registry`);
    return value;
  }

  delete(id: number): void {
    this.map.delete(id);
  }

  has(id: number): boolean {
    return this.map.has(id);
  }
}

let eventListenerCounter = 0;

export function makeEventListener(type: string): { _type: string; _id: number } {
  return { _type: type, _id: ++eventListenerCounter };
}

export function makeHandle(id: number): { _handleId: number } {
  return { _handleId: id };
}
