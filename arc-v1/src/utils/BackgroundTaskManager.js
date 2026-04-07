import { InteractionManager } from 'react-native';

class BackgroundTaskManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(task) {
    this.queue.push(task);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    try {
      await InteractionManager.runAfterInteractions(async () => {
        await this.executeTask(task);
      });
    } catch (error) {
      console.error('Task execution error:', error);
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }

  async executeTask(task) {
    const { type, payload, onComplete } = task;

    switch (type) {
      case 'NOTE':
        await this.handleNote(payload);
        break;
      case 'ACTION_ITEM':
        await this.handleActionItem(payload);
        break;
      default:
        console.warn('Unknown task type:', type);
    }

    if (onComplete) onComplete(task);
  }

  async handleNote(payload) {
    const { text, category } = payload;
    console.log(`[Task: Note] Saved in ${category || 'General'}: "${text}"`);
    // Future integration with local storage or API
    return Promise.resolve();
  }

  async handleActionItem(payload) {
    const { text, priority } = payload;
    console.log(`[Task: Action Item] [Priority: ${priority || 'Medium'}] "${text}" logged.`);
    // Future integration with a task management API
    return Promise.resolve();
  }
}

export const backgroundTaskManager = new BackgroundTaskManager();
