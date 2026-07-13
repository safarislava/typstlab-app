export class CompilerQueue {
  private queue: Promise<any> = Promise.resolve();
  private latestTaskId: number = 0;

  /**
   * Schedules a compilation task. If a task is already running,
   * this task will wait for it to finish. If a newer task has been scheduled
   * in the meantime, this task will skip execution and return null, ensuring
   * only the absolute latest code gets compiled and preventing concurrent borrows.
   */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    const taskId = ++this.latestTaskId;

    const result = this.queue.then(async () => {
      // If a newer task has been scheduled, discard this one to save CPU and avoid WASM conflicts
      if (taskId < this.latestTaskId) {
        return null;
      }
      return await task();
    });

    // Chain the queue to wait for the completion of this task (success or fail)
    this.queue = result.then(
      () => {},
      () => {}
    );

    return result;
  }
}

// Global instance of the compiler task queue
export const globalCompilerQueue = new CompilerQueue();
