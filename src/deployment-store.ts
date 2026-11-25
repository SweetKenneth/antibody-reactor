import { constants, openSync, closeSync, fstatSync, readSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256 } from './hash.js';

export interface DeploymentStore { save(snapshot: unknown): void }

/** Single-writer atomic checkpoints. Keep the returned digest OUTSIDE the writable state directory. */
export class FileDeploymentStore implements DeploymentStore {
  private currentDigest: string | undefined;
  private failed = false;

  constructor(private readonly file: string, expectedDigest?: string) {
    this.currentDigest = expectedDigest;
    if (expectedDigest !== undefined && !/^[0-9a-f]{64}$/.test(expectedDigest)) throw new Error('invalid checkpoint pin');
  }

  load(): unknown {
    if (!this.currentDigest) throw new Error('restart requires an independently retained checkpoint digest');
    const raw = this.read();
    if (sha256(raw) !== this.currentDigest) throw new Error('checkpoint differs from trusted digest');
    return JSON.parse(raw);
  }

  digest(): string | undefined { return this.currentDigest; }

  private read(): string {
    const fd = openSync(this.file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('invalid or oversized checkpoint file');
      const bytes = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < bytes.length) {
        const n = readSync(fd, bytes, length, bytes.length - length, null);
        if (n === 0) break;
        length += n;
      }
      if (length > stat.size) throw new Error('checkpoint grew while reading');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
    } finally { closeSync(fd); }
  }

  save(snapshot: unknown): void {
    if (this.failed) throw new Error('checkpoint store is faulted');
    const lock = `${this.file}.lock`;
    const tmp = `${this.file}.${randomUUID()}.tmp`;
    let lockFd: number | undefined;
    let tmpFd: number | undefined;
    let failure: unknown;
    try {
      lockFd = openSync(lock, 'wx', 0o600);
      if (this.currentDigest !== undefined) {
        if (sha256(this.read()) !== this.currentDigest) throw new Error('concurrent or tampered checkpoint');
      } else {
        try { this.read(); throw new Error('existing checkpoint requires trusted restart pin'); }
        catch (e) { if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e; }
      }
      const raw = JSON.stringify(snapshot);
      if (Buffer.byteLength(raw, 'utf8') > 32 * 1024 * 1024) throw new Error('checkpoint exceeds 32 MiB; operator archival required');
      tmpFd = openSync(tmp, 'wx', 0o600);
      writeFileSync(tmpFd, raw, 'utf8'); fsyncSync(tmpFd); closeSync(tmpFd); tmpFd = undefined;
      renameSync(tmp, this.file);
      const dirFd = openSync(path.dirname(this.file), constants.O_RDONLY);
      try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
      this.currentDigest = sha256(raw);
    } catch (error) { failure = error; }
    finally {
      const cleanup = (f: () => void) => { try { f(); } catch (e) { failure ??= e; } };
      if (tmpFd !== undefined) { const fd = tmpFd; cleanup(() => closeSync(fd)); }
      try { unlinkSync(tmp); } catch { /* no remaining temporary checkpoint */ }
      if (lockFd !== undefined) { const fd = lockFd; cleanup(() => closeSync(fd)); cleanup(() => unlinkSync(lock)); }
    }
    if (failure !== undefined) { this.failed = true; throw failure; }
  }
}