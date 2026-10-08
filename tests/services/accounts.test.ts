import { describe, expect, it } from "vitest";
import type { Account } from "@/lib/model/types";
import { createMockAccountRepository, accountOf, mockAccounts } from "@/lib/services/mock/accounts";
import { createMockContext } from "@/lib/services/mock/context";
import { members } from "@/mock/community";

/** An account register where `as` decides who is asking. */
function register() {
  const accounts = mockAccounts();
  let current: Account | null = accountOf(accounts[0]);
  const context = createMockContext(() => current);
  const people = structuredClone(members);
  const repo = createMockAccountRepository(context, accounts, () => people);
  return {
    repo,
    accounts,
    context,
    people,
    as: (id: string | null) => {
      const found = id ? accounts.find((a) => a.id === id) : undefined;
      current = found ? accountOf(found) : null;
    },
  };
}

describe("accounts and identities (fixtures backend)", () => {
  it("never lets the last active administrator go, by demotion, suspension or closure", async () => {
    const { repo } = register();
    await expect(repo.setRole("a-qingkong", "reader")).rejects.toMatchObject({ reason: "last_admin" });
    await repo.setRole("acct-sample-reader", "admin", "Second admin");
    await repo.setRole("a-qingkong", "reader");
    const after = (await register().repo.listAccounts()).rows;
    expect(after.length).toBeGreaterThan(0);
  });

  it("refuses to make an unverified account an administrator and gives a new one an author record", async () => {
    const { repo, accounts } = register();
    await expect(repo.setRole("acct-sample-unverified", "admin")).rejects.toMatchObject({ reason: "account_not_active" });
    await repo.setRole("acct-sample-reader", "admin");
    expect(accounts.find((a) => a.id === "acct-sample-reader")?.authorId).toBe("a-sample-reader");
  });

  it("suspends with a reason, takes writing away at once, and reactivates", async () => {
    const { repo, accounts, as, context } = register();
    await expect(repo.setStatus("acct-sample-reader", "suspended")).rejects.toMatchObject({ reason: "reason_required" });
    await expect(repo.setStatus("a-qingkong", "suspended", "self")).rejects.toMatchObject({ reason: "cannot_change_own_status" });
    await repo.setStatus("acct-sample-reader", "suspended", "Spam");
    as("acct-sample-reader");
    expect(() => context.requireActive()).toThrowError(expect.objectContaining({ reason: "verified_account_required" }));
    as("a-qingkong");
    await repo.setStatus("acct-sample-reader", "active");
    expect(accounts.find((a) => a.id === "acct-sample-reader")?.status).toBe("active");
  });

  it("decides an application once, creating and binding author and page together", async () => {
    const { repo, accounts, people } = register();
    const [pending] = (await repo.listApplications()).rows;
    await expect(repo.decideApplication(pending.id, "rejected", {})).rejects.toMatchObject({ reason: "reason_required" });
    await expect(repo.decideApplication(pending.id, "approved", {})).rejects.toMatchObject({ reason: "nothing_to_bind" });
    await repo.decideApplication(pending.id, "approved", {
      author: { mode: "create", handle: "reader-x", name: { zh: "读者", en: "Reader X" } },
      member: { mode: "create", handle: "reader-x", name: { zh: "读者", en: "Reader X" } },
    });
    const reader = accounts.find((a) => a.id === "acct-sample-reader")!;
    expect(reader).toMatchObject({ authorId: "a-reader-x", memberId: "m-reader-x" });
    expect(people.find((m) => m.id === "m-reader-x")?.authorId).toBe("a-reader-x");
    await expect(repo.decideApplication(pending.id, "approved", { author: { mode: "existing", id: "a-qingkong" } })).rejects.toMatchObject({
      reason: "application_decided",
    });
  });

  it("refuses a binding that would take another account's page, and changes nothing", async () => {
    const { repo, accounts } = register();
    await expect(repo.setIdentity("acct-sample-reader", { memberId: "m-qingkong" })).rejects.toMatchObject({ reason: "member_already_bound" });
    expect(accounts.find((a) => a.id === "acct-sample-reader")?.memberId).toBeUndefined();
    await expect(repo.setIdentity("a-qingkong", { authorId: null })).rejects.toMatchObject({ reason: "admin_needs_author" });
  });

  it("lets a reader ask for closure, and an administrator close the account without losing history", async () => {
    const { repo, accounts, as } = register();
    as("acct-sample-reader");
    await repo.submitApplication({ kind: "author", statement: "x" }).catch(() => undefined);
    await repo.requestClosure("Leaving");
    as("a-qingkong");
    expect((await repo.listAccounts({ flag: "closure" })).rows.map((a) => a.id)).toEqual(["acct-sample-reader"]);
    await expect(repo.closeAccount("a-qingkong")).rejects.toMatchObject({ reason: "cannot_close_own_account" });
    await repo.closeAccount("acct-sample-reader", "Requested");
    await repo.closeAccount("acct-sample-reader");
    const closed = accounts.find((a) => a.id === "acct-sample-reader")!;
    expect(closed).toMatchObject({ status: "closed", role: "reader", name: { en: "Closed account" } });
    expect(closed.email).toMatch(/@closed\.invalid$/);
    expect((await repo.listApplications({ status: [] })).rows.some((a) => a.accountId === "acct-sample-reader")).toBe(false);
  });

  it("keeps one pending application per account", async () => {
    const { repo, as } = register();
    as("acct-sample-unverified");
    await expect(repo.submitApplication({ kind: "author", statement: "hi" })).rejects.toMatchObject({ reason: "verified_account_required" });
    as("acct-sample-reader");
    await expect(repo.submitApplication({ kind: "author", statement: "again" })).rejects.toMatchObject({ reason: "application_pending" });
  });
});
