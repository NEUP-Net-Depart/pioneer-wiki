import type { Account, AccountRecord, IdentityApplication, Localized, Member } from "@/lib/model/types";
import { ServiceError, type AccountRepository, type IdentityChoice } from "@/lib/services/contracts";
import { paginate, type MockContext } from "./context";

/*
 * In-memory accounts for the fixtures backend. The signed-in account is the
 * first one (青空, an administrator); the others are obvious placeholders so
 * the administrators' screens have something to show. Sign-up, sign-in and
 * email belong to Supabase Auth and are unavailable here.
 */

export interface MockAccount extends AccountRecord {
  sigil: string;
}

export function mockAccounts(): MockAccount[] {
  const created = "2026-10-01T09:00:00+08:00";
  return [
    {
      id: "a-qingkong",
      email: "qingkong@example.test",
      handle: "qingkong",
      name: { zh: "青空", en: "Qingkong" },
      role: "admin",
      status: "active",
      emailVerified: true,
      authorId: "a-qingkong",
      authorName: { zh: "青空", en: "Qingkong" },
      memberId: "m-qingkong",
      memberHandle: "qingkong",
      memberName: { zh: "青空", en: "Qingkong" },
      createdAt: created,
      sigil: "qingkong",
    },
    {
      id: "acct-sample-reader",
      email: "reader@example.test",
      handle: "sample-reader",
      name: { zh: "示例读者", en: "Sample reader" },
      role: "reader",
      status: "active",
      emailVerified: true,
      createdAt: "2026-10-03T10:00:00+08:00",
      sigil: "sample-reader",
    },
    {
      id: "acct-sample-unverified",
      email: "unverified@example.test",
      handle: "sample-unverified",
      name: { zh: "未验证读者", en: "Unverified reader" },
      role: "reader",
      status: "active",
      emailVerified: false,
      createdAt: "2026-10-05T10:00:00+08:00",
      sigil: "sample-unverified",
    },
  ];
}

export function accountOf(record: MockAccount): Account {
  return {
    id: record.id,
    email: record.email,
    handle: record.handle,
    name: record.name,
    sigil: record.sigil,
    role: record.role === "admin" && record.status === "active" ? "admin" : "reader",
    emailVerified: record.emailVerified,
    status: record.status,
    authorId: record.status === "active" ? record.authorId : undefined,
    memberId: record.memberId,
    closureRequestedAt: record.closureRequestedAt,
  };
}

export function createMockAccountRepository(
  context: MockContext,
  accounts: MockAccount[],
  members: () => Member[],
): AccountRepository {
  const applications: IdentityApplication[] = [
    {
      id: "app-sample-1",
      accountId: "acct-sample-reader",
      kind: "both",
      statement: "示例申请：我想撰写编译器方向的条目。 · Sample application: I would like to write about compilers.",
      proposedHandle: "sample-reader",
      status: "pending",
      createdAt: "2026-10-06T12:00:00+08:00",
    },
  ];
  const self = () => {
    const account = context.account();
    const record = account && accounts.find((a) => a.id === account.id);
    if (!record || record.status === "closed") throw new ServiceError("forbidden", "account_required");
    return record;
  };
  const target = (id: string) => {
    const record = accounts.find((a) => a.id === id);
    if (!record) throw new ServiceError("invalid", "profile_not_found");
    return record;
  };
  const activeAdmins = (except?: string) =>
    accounts.filter((a) => a.id !== except && a.role === "admin" && a.status === "active" && a.emailVerified).length;
  const withAccount = (app: IdentityApplication): IdentityApplication => {
    const record = accounts.find((a) => a.id === app.accountId);
    return {
      ...structuredClone(app),
      account: record
        ? {
            handle: record.handle,
            email: record.email,
            name: record.name,
            authorId: record.authorId,
            memberId: record.memberId,
            status: record.status,
          }
        : undefined,
    };
  };
  const pending = (accountId: string) => applications.find((a) => a.accountId === accountId && a.status === "pending");

  const bind = (record: MockAccount, patch: { authorId?: string | null; memberId?: string | null }) => {
    if (record.status === "closed") throw new ServiceError("conflict", "account_closed");
    const authorId = patch.authorId === undefined ? record.authorId : (patch.authorId ?? undefined);
    const memberId = patch.memberId === undefined ? record.memberId : (patch.memberId ?? undefined);
    if (authorId) {
      const author = context.authors.find((a) => a.id === authorId);
      if (!author) throw new ServiceError("invalid", "author_not_found");
      if (accounts.some((a) => a.id !== record.id && a.authorId === authorId))
        throw new ServiceError("conflict", "author_already_bound");
    }
    let member: Member | undefined;
    if (memberId) {
      member = members().find((m) => m.id === memberId);
      if (!member) throw new ServiceError("invalid", "member_not_found");
      if (accounts.some((a) => a.id !== record.id && a.memberId === memberId))
        throw new ServiceError("conflict", "member_already_bound");
      if (authorId && member.authorId && member.authorId !== authorId)
        throw new ServiceError("conflict", "member_author_mismatch");
    }
    if (record.role === "admin" && !authorId) throw new ServiceError("conflict", "admin_needs_author");
    if (member && authorId && !member.authorId) member.authorId = authorId;
    const before = { authorId: record.authorId, memberId: record.memberId };
    record.authorId = authorId;
    record.authorName = context.authors.find((a) => a.id === authorId)?.name;
    record.memberId = memberId;
    record.memberHandle = member?.handle;
    record.memberName = member?.name;
    context.audit("bind_identity", "profile", record.id, before, { authorId, memberId });
  };
  const choose = (choice: IdentityChoice | null | undefined, kind: "author" | "member", authorId?: string) => {
    if (!choice) return undefined;
    if (choice.mode === "existing") return choice.id;
    const handle = choice.handle.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle) || handle.length > 32)
      throw new ServiceError("invalid", kind === "author" ? "invalid_author_handle" : "invalid_member_handle");
    if (kind === "author") {
      if (context.authors.some((a) => a.handle === handle || a.id === `a-${handle}`))
        throw new ServiceError("conflict", "author_handle_taken");
      context.authors.push({ id: `a-${handle}`, handle, name: choice.name, affiliation: choice.affiliation, role: "contributor", sigil: `author:${handle}` });
      return `a-${handle}`;
    }
    const list = members();
    if (list.some((m) => m.handle === handle || m.id === `m-${handle}`)) throw new ServiceError("conflict", "member_handle_taken");
    list.push({
      id: `m-${handle}`,
      handle,
      name: choice.name,
      role: choice.role ?? { zh: "成员", en: "Member" },
      bio: choice.bio ?? { zh: "", en: "" },
      about: "",
      plate: { number: Math.max(0, ...list.map((m) => m.plate.number)) + 1, emblem: "ex-quill", ink: "prussian", border: "vine", motto: "" },
      joined: new Date().toISOString().slice(0, 10),
      authorId,
      links: [],
      projects: [],
      version: 1,
    });
    return `m-${handle}`;
  };

  return {
    async updateOwnProfile(name: Localized) {
      const record = self();
      const next = { zh: name.zh.trim(), en: name.en.trim() };
      if (!next.zh || !next.en || next.zh.length > 40 || next.en.length > 40)
        throw new ServiceError("invalid", "invalid_display_name");
      record.name = next;
      return next;
    },
    async requestClosure() {
      const record = self();
      record.closureRequestedAt ??= new Date().toISOString();
      context.audit("request_closure", "profile", record.id);
      return { requestedAt: record.closureRequestedAt };
    },
    async cancelClosure() {
      const record = self();
      record.closureRequestedAt = undefined;
      context.audit("cancel_closure", "profile", record.id);
    },
    async listOwnApplications() {
      const account = context.account();
      return applications.filter((a) => a.accountId === account?.id).map(withAccount);
    },
    async submitApplication(input) {
      const account = context.requireActive();
      if (!["author", "member", "both"].includes(input.kind)) throw new ServiceError("invalid", "invalid_kind");
      const statement = input.statement?.trim() ?? "";
      if (!statement || statement.length > 2000) throw new ServiceError("invalid", "invalid_statement");
      if (pending(account.id)) throw new ServiceError("conflict", "application_pending");
      const app: IdentityApplication = {
        id: `app-${applications.length + 1}`,
        accountId: account.id,
        kind: input.kind,
        statement,
        proposedHandle: input.handle?.trim().toLowerCase() || undefined,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      applications.unshift(app);
      context.audit("submit_application", "application", app.id);
      return withAccount(app);
    },
    async withdrawApplication(id) {
      const account = context.account();
      const app = applications.find((a) => a.id === id && a.accountId === account?.id);
      if (!app) throw new ServiceError("invalid", "application_not_found");
      if (app.status !== "pending") throw new ServiceError("conflict", "application_decided");
      app.status = "withdrawn";
      return withAccount(app);
    },
    async todo() {
      context.requireActive(true);
      return {
        reviews: 0,
        applications: applications.filter((a) => a.status === "pending").length,
        closures: accounts.filter((a) => a.closureRequestedAt && a.status !== "closed").length,
        assets: context.assets.filter((a) => a.reviewStatus === "pending").length,
        suspended: accounts.filter((a) => a.status === "suspended").length,
      };
    },
    async listAccounts(query = {}) {
      context.requireActive(true);
      const text = query.text?.trim().toLowerCase() ?? "";
      const rows = accounts
        .filter(
          (a) =>
            !text ||
            [a.email, a.handle, a.name.zh, a.name.en, a.authorName?.zh, a.memberHandle].some((v) => v?.toLowerCase().includes(text)),
        )
        .filter((a) => !query.status?.length || query.status.includes(a.status))
        .filter((a) => !query.role?.length || query.role.includes(a.role))
        .filter((a) => {
          switch (query.flag) {
            case "closure":
              return Boolean(a.closureRequestedAt) && a.status !== "closed";
            case "unverified":
              return !a.emailVerified;
            case "bound":
              return Boolean(a.authorId || a.memberId);
            case "unbound":
              return !a.authorId && !a.memberId;
            case "applicant":
              return Boolean(pending(a.id));
            default:
              return true;
          }
        })
        .map((a): AccountRecord => {
          const { sigil, ...record } = a;
          void sigil;
          return { ...structuredClone(record), pendingApplicationId: pending(a.id)?.id };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return paginate(rows, query.limit, query.offset);
    },
    async setRole(id, role, reason) {
      context.requireActive(true);
      const record = target(id);
      if (role !== "reader" && role !== "admin") throw new ServiceError("invalid", "invalid_role");
      if (record.role === role) throw new ServiceError("conflict", "unchanged_role");
      if (role === "reader" && record.role === "admin" && record.status === "active" && activeAdmins(id) === 0)
        throw new ServiceError("conflict", "last_admin");
      if (role === "admin" && (record.status !== "active" || !record.emailVerified))
        throw new ServiceError("conflict", "account_not_active");
      record.role = role;
      if (role === "admin" && !record.authorId) {
        const authorId = `a-${record.handle}`;
        if (!context.authors.some((a) => a.id === authorId))
          context.authors.push({ id: authorId, handle: record.handle, name: record.name, role: "editor", sigil: record.sigil });
        record.authorId = authorId;
        record.authorName = record.name;
      }
      context.audit("set_role", "profile", id, null, { role, reason: reason ?? null });
    },
    async setStatus(id, status, reason) {
      const actor = context.requireActive(true);
      if (id === actor.id) throw new ServiceError("conflict", "cannot_change_own_status");
      const record = target(id);
      if (record.status === "closed") throw new ServiceError("conflict", "account_closed");
      if (record.status === status) throw new ServiceError("conflict", "unchanged_status");
      if (status === "suspended") {
        if (!reason?.trim()) throw new ServiceError("invalid", "reason_required");
        if (record.role === "admin" && activeAdmins(id) === 0) throw new ServiceError("conflict", "last_admin");
      }
      record.status = status;
      record.statusReason = status === "suspended" ? reason?.trim() : undefined;
      context.audit(status === "suspended" ? "suspend_account" : "reactivate_account", "profile", id, null, {
        reason: reason ?? null,
      });
    },
    async setIdentity(id, patch, reason) {
      context.requireActive(true);
      bind(target(id), patch);
      void reason;
    },
    async closeAccount(id, note) {
      const actor = context.requireActive(true);
      if (id === actor.id) throw new ServiceError("conflict", "cannot_close_own_account");
      const record = target(id);
      if (record.status === "closed") return;
      if (record.role === "admin" && activeAdmins(id) === 0) throw new ServiceError("conflict", "last_admin");
      const member = members().find((m) => m.id === record.memberId);
      if (member) member.archivedAt ??= new Date().toISOString();
      Object.assign(record, {
        role: "reader",
        status: "closed",
        authorId: undefined,
        authorName: undefined,
        memberId: undefined,
        memberHandle: undefined,
        memberName: undefined,
        name: { zh: "已注销读者", en: "Closed account" },
        email: `closed+${id}@closed.invalid`,
        handle: `closed-${id.slice(0, 12)}`,
        closedAt: new Date().toISOString(),
        closureRequestedAt: record.closureRequestedAt ?? new Date().toISOString(),
      });
      for (let i = applications.length - 1; i >= 0; i--) if (applications[i].accountId === id) applications.splice(i, 1);
      context.audit("close_account", "profile", id, null, { status: "closed", note: note ?? null });
    },
    async listApplications(query = {}) {
      context.requireActive(true);
      const statuses = query.status ?? ["pending"];
      const rows = applications
        .filter((a) => !statuses.length || statuses.includes(a.status))
        .map(withAccount)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return paginate(rows, query.limit, query.offset);
    },
    async decideApplication(id, decision, input) {
      context.requireActive(true);
      const app = applications.find((a) => a.id === id);
      if (!app) throw new ServiceError("invalid", "application_not_found");
      if (app.status !== "pending") throw new ServiceError("conflict", "application_decided");
      if (decision === "rejected") {
        if (!input.reason?.trim()) throw new ServiceError("invalid", "reason_required");
      } else {
        const record = target(app.accountId ?? "");
        if (!input.author && !input.member) throw new ServiceError("invalid", "nothing_to_bind");
        // Check everything before creating anything, as the transaction would.
        const authorId = choose(input.author, "author");
        const memberId = choose(input.member, "member", authorId ?? record.authorId);
        bind(record, { ...(authorId ? { authorId } : {}), ...(memberId ? { memberId } : {}) });
      }
      app.status = decision;
      app.decisionReason = input.reason?.trim() || undefined;
      app.decidedAt = new Date().toISOString();
      context.audit("decide_application", "application", id, { status: "pending" }, { status: decision });
      return withAccount(app);
    },
  };
}
