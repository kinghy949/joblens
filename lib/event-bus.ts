/**
 * Tiny pub-sub queue that supports concurrent producers and a single async
 * iterator consumer. Used by the orchestrator to fan in events from agents
 * running in parallel and surface them as a single ordered stream.
 */
export class EventBus<E> implements AsyncIterable<E> {
  private queue: E[] = []
  private resolvers: Array<(r: IteratorResult<E>) => void> = []
  private closed = false

  push(event: E): void {
    if (this.closed) return
    const next = this.resolvers.shift()
    if (next) next({ value: event, done: false })
    else this.queue.push(event)
  }

  close(): void {
    this.closed = true
    while (this.resolvers.length > 0) {
      const r = this.resolvers.shift()!
      r({ value: undefined as unknown as E, done: true })
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<E> {
    return {
      next: () => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false })
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined as unknown as E, done: true })
        }
        return new Promise<IteratorResult<E>>((resolve) => this.resolvers.push(resolve))
      },
    }
  }
}
