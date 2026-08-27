export class CompilerQueue {
  private queue: Promise<any> = Promise.resolve();
  private latestTaskId: number = 0;

  /**
   * Schedules a compilation task. Discards stale tasks if newer ones arrive.
   */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    const taskId = ++this.latestTaskId;

    const result = this.queue.then(async () => {
      if (taskId < this.latestTaskId) {
        return null;
      }
      return await task();
    });

    this.queue = result.then(
      () => {},
      () => {}
    );

    return result;
  }
}

export const compilerQueue = new CompilerQueue();
