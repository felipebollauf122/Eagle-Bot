export interface PoolAccount {
  id: string;
  phoneNumber: string;
  sessionString: string;
  status: "active" | "flood_wait" | "banned" | "disconnected";
  floodWaitUntil: Date | null;
}

export class AccountPool {
  private accounts: PoolAccount[] = [];
  private cursor = 0;

  load(accounts: PoolAccount[]): void {
    this.accounts = accounts.map((a) => ({ ...a }));
    this.cursor = 0;
  }

  private isAvailable(a: PoolAccount): boolean {
    if (a.status === "banned" || a.status === "disconnected") return false;
    if (a.status === "flood_wait") {
      if (!a.floodWaitUntil) return true;
      return a.floodWaitUntil.getTime() <= Date.now();
    }
    return a.status === "active";
  }

  next(): PoolAccount | null {
    if (this.accounts.length === 0) return null;
    for (let i = 0; i < this.accounts.length; i++) {
      const idx = (this.cursor + i) % this.accounts.length;
      const candidate = this.accounts[idx];
      if (this.isAvailable(candidate)) {
        this.cursor = (idx + 1) % this.accounts.length;
        return candidate;
      }
    }
    return null;
  }

  markFloodWait(id: string, seconds: number): void {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) return;
    a.status = "flood_wait";
    a.floodWaitUntil = new Date(Date.now() + seconds * 1000);
  }

  markBanned(id: string): void {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) return;
    a.status = "banned";
  }
}
