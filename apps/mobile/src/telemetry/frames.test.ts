import { describe, expect, it, jest } from '@jest/globals';

import { startFrameSampler, summarizeFrames } from './frames';

describe('summarizeFrames', () => {
  it('counts frames slower than two refreshes, and freezes', () => {
    const intervals = [...Array<number>(95).fill(16.7), 40, 40, 40, 800, 16.7];
    expect(summarizeFrames(intervals)).toEqual({ frames: 100, slowPercent: 4, frozen: 1 });
  });

  it('says nothing about too few frames', () => {
    expect(summarizeFrames([16, 16, 16])).toBeNull();
  });
});

describe('startFrameSampler', () => {
  it('measures a 10 second window, then waits before the next one, and stops cleanly', () => {
    let callbacks: Array<(time: number) => void> = [];
    const timers: Array<() => void> = [];
    const onWindow = jest.fn();
    const stop = startFrameSampler({
      onWindow,
      raf: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancelRaf: () => undefined,
      setTimer: (callback) => {
        timers.push(callback);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });

    // 10 secondi a 60 fps, con un blocco a metà.
    let time = 0;
    for (let frame = 0; frame <= 601; frame += 1) {
      const next = callbacks.shift();
      if (!next) break;
      time += frame === 300 ? 900 : 16.7;
      next(time);
    }

    expect(onWindow).toHaveBeenCalledTimes(1);
    expect(onWindow.mock.calls[0]![0]).toMatchObject({ frozen: 1 });
    expect(timers).toHaveLength(1);
    stop();
    callbacks = [];
  });
});
