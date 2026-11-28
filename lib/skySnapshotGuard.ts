/** Prevent a delayed poll from overwriting the result of a player action. */
export class SkySnapshotGuard {
  private epoch = 0;
  private busy = false;
  beginAction() { this.busy = true; this.epoch++; }
  endAction() { this.epoch++; this.busy = false; }
  capture() { return this.epoch; }
  canApply(epoch: number, force = false) {
    return epoch === this.epoch && (!this.busy || force);
  }
}
