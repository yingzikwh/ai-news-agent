// 简单事件总线，用于向 SSE 客户端广播新消息
import { EventEmitter } from 'events';

export const bus = new EventEmitter();
bus.setMaxListeners(0);

export interface SseEvent {
  type: 'news' | 'stats' | 'status';
  items?: any[];
  stats?: any;
  message?: string;
  mode?: string;
}

export function broadcast(event: SseEvent): void {
  bus.emit('event', event);
}
