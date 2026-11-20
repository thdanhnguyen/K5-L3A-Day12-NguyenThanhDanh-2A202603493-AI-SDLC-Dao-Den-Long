import { FormatError, type InputFrame, type InputState, type StepInput } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateAndParseInputs(rawJson: string): InputFrame[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new FormatError(`Invalid JSON in inputs file: ${(err as Error).message}`);
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.frames)) {
    throw new FormatError('Inputs root must be an object with a "frames" array');
  }

  const frames: InputFrame[] = [];
  let prevTick = -1;

  for (let i = 0; i < parsed.frames.length; i++) {
    const raw = parsed.frames[i];
    if (!isPlainObject(raw)) {
      throw new FormatError(`inputs.frames[${i}] must be an object`);
    }
    if (typeof raw.tick !== 'number' || !Number.isInteger(raw.tick) || raw.tick < 0) {
      throw new FormatError(`inputs.frames[${i}].tick must be a non-negative integer`);
    }
    if (raw.tick <= prevTick) {
      throw new FormatError(
        `inputs.frames[${i}].tick (${raw.tick}) must be strictly increasing (> ${prevTick})`
      );
    }
    prevTick = raw.tick;

    const frame: InputFrame = { tick: raw.tick };

    if ('move' in raw && raw.move !== undefined) {
      if (!Array.isArray(raw.move) || raw.move.length !== 2) {
        throw new FormatError(`inputs.frames[${i}].move must be a [x, z] 2-element array`);
      }
      const [mx, mz] = raw.move;
      if (
        typeof mx !== 'number' ||
        typeof mz !== 'number' ||
        !Number.isFinite(mx) ||
        !Number.isFinite(mz) ||
        mx < -1 ||
        mx > 1 ||
        mz < -1 ||
        mz > 1
      ) {
        throw new FormatError(`inputs.frames[${i}].move components must be finite numbers in [-1, 1]`);
      }
      frame.move = [mx, mz];
    }

    if ('cam_yaw_deg' in raw && raw.cam_yaw_deg !== undefined) {
      if (typeof raw.cam_yaw_deg !== 'number' || !Number.isFinite(raw.cam_yaw_deg)) {
        throw new FormatError(`inputs.frames[${i}].cam_yaw_deg must be a finite number`);
      }
      frame.cam_yaw_deg = raw.cam_yaw_deg;
    }

    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (key in raw && raw[key] !== undefined) {
        if (typeof raw[key] !== 'boolean') {
          throw new FormatError(`inputs.frames[${i}].${key} must be a boolean`);
        }
        frame[key] = raw[key];
      }
    }

    frames.push(frame);
  }

  return frames;
}

export function transformMoveToWorld(
  move: [number, number],
  camYawDeg: number
): [number, number] {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  if (len === 0) {
    return [0, 0];
  }
  const theta = (camYawDeg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const wx = x * cosT + z * sinT;
  const wz = -x * sinT + z * cosT;
  return [wx, wz];
}

export class InputTimeline {
  private readonly frames: InputFrame[];
  private cursor = 0;
  private held: InputState = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
  private prevJump = false;
  private prevInteract = false;
  private prevPulse = false;
  private prevDash = false;
  private prevPause = false;

  constructor(frames: InputFrame[] = []) {
    this.frames = frames;
  }

  sampleForTick(tick: number): StepInput {
    while (this.cursor < this.frames.length && this.frames[this.cursor].tick < tick) {
      this.applyFrame(this.frames[this.cursor]);
      this.cursor++;
    }
    if (this.cursor < this.frames.length && this.frames[this.cursor].tick === tick) {
      this.applyFrame(this.frames[this.cursor]);
      this.cursor++;
    }

    const stepInput: StepInput = {
      move: [this.held.move[0], this.held.move[1]],
      camYawDeg: this.held.cam_yaw_deg,
      jumpPressed: this.held.jump && !this.prevJump,
      interactPressed: this.held.interact && !this.prevInteract,
      pulsePressed: this.held.pulse && !this.prevPulse,
      dashPressed: this.held.dash && !this.prevDash,
      pausePressed: this.held.pause && !this.prevPause,
    };

    this.prevJump = this.held.jump;
    this.prevInteract = this.held.interact;
    this.prevPulse = this.held.pulse;
    this.prevDash = this.held.dash;
    this.prevPause = this.held.pause;

    return stepInput;
  }

  private applyFrame(frame: InputFrame): void {
    if (frame.move !== undefined) {
      this.held.move = [frame.move[0], frame.move[1]];
    }
    if (frame.cam_yaw_deg !== undefined) {
      this.held.cam_yaw_deg = frame.cam_yaw_deg;
    }
    if (frame.jump !== undefined) {
      this.held.jump = frame.jump;
    }
    if (frame.interact !== undefined) {
      this.held.interact = frame.interact;
    }
    if (frame.pulse !== undefined) {
      this.held.pulse = frame.pulse;
    }
    if (frame.dash !== undefined) {
      this.held.dash = frame.dash;
    }
    if (frame.pause !== undefined) {
      this.held.pause = frame.pause;
    }
  }
}
