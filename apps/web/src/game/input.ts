import { IN_LEFT, IN_RIGHT, IN_JUMP, IN_LINK } from '@zh/sim';

// Локальна гра вдвох на одній клавіатурі. e.code — фізичні клавіші, тож працює з будь-якою розкладкою.
const KEYMAP: Record<string, [number, number]> = {
  KeyA: [0, IN_LEFT], KeyD: [0, IN_RIGHT], KeyW: [0, IN_JUMP], KeyS: [0, IN_LINK],
  ArrowLeft: [1, IN_LEFT], ArrowRight: [1, IN_RIGHT], ArrowUp: [1, IN_JUMP], ArrowDown: [1, IN_LINK],
};

export const isTyping = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

export class Keyboard {
  private down: [number, number] = [0, 0];
  // Коротке натискання між двома кроками симуляції не губиться: тримаємо його до найближчого читання
  private latched: [number, number] = [0, 0];

  private onDown = (e: KeyboardEvent) => {
    const m = KEYMAP[e.code];
    if (!m || isTyping(e)) return; // поки пишуть у чат, герої стоять
    e.preventDefault();
    this.down[m[0]] |= m[1];
    this.latched[m[0]] |= m[1];
  };
  private onUp = (e: KeyboardEvent) => { const m = KEYMAP[e.code]; if (m) this.down[m[0]] &= ~m[1]; };
  private onBlur = () => { this.down = [0, 0]; };

  attach() {
    addEventListener('keydown', this.onDown);
    addEventListener('keyup', this.onUp);
    addEventListener('blur', this.onBlur);
  }
  detach() {
    removeEventListener('keydown', this.onDown);
    removeEventListener('keyup', this.onUp);
    removeEventListener('blur', this.onBlur);
  }
  read(): [number, number] {
    const r: [number, number] = [this.down[0] | this.latched[0], this.down[1] | this.latched[1]];
    this.latched = [0, 0];
    return r;
  }
}
