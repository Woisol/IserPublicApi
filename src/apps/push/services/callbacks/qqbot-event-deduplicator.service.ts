import { Injectable } from '@nestjs/common';

@Injectable()
export class QqbotEventDeduplicatorService {
  private readonly events = new Map<string, number>();
  private readonly ttl = 10 * 60 * 1000;

  isDuplicate(key: string): boolean {
    const now = Date.now();
    for (const [eventKey, timestamp] of this.events) {
      if (now - timestamp > this.ttl) this.events.delete(eventKey);
    }
    if (this.events.has(key)) return true;
    this.events.set(key, now);
    return false;
  }
}
