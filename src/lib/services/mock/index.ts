import { createMockEntryRepository, publishedSearchSource } from "./repository";
import { createMockTaxonomyRepository, createTaxonomyStore } from "./taxonomy";
import { createMockCommunityRepository } from "./community";
import { createMockChronicleRepository } from "./chronicles";
import { createMockReferenceRepository } from "./references";
import { accountOf, createMockAccountRepository, mockAccounts } from "./accounts";
import { createMockContext, paginate } from "./context";
import { createMockSearchAdapter } from "@/lib/search/adapter";
import { members } from "@/mock/community";
import type { EntryRepository, WikiServices } from "@/lib/services/contracts";
import type { Member } from "@/lib/model/types";
import { chronicles } from "@/mock/chronicles";

/*
 * The deterministic fixtures backend: every repository in memory, with the
 * same rules as the database. 青空 (an administrator) is always signed in;
 * sign-up, sign-in and email need Supabase Auth and report "unavailable".
 */
export function createMockServices(): WikiServices {
  const accounts = mockAccounts();
  const context = createMockContext(() => accountOf(accounts[0]));
  const catalogue = createTaxonomyStore();
  const people: Member[] = structuredClone(members).map((m) => ({ ...m, version: 1 }));
  const entries: EntryRepository = createMockEntryRepository(catalogue, context);
  const community = createMockCommunityRepository(context, people);
  const accountRepository = createMockAccountRepository(context, accounts, () => people);
  return {
    entries,
    taxonomy: createMockTaxonomyRepository(catalogue),
    references: createMockReferenceRepository(context, () => entries),
    search: createMockSearchAdapter(publishedSearchSource(entries)),
    auth: {
      getCurrentAccount: async () => accountOf(accounts[0]),
      getCurrentUser: async () => {
        const authorId = accountOf(accounts[0]).authorId;
        return context.authors.find((author) => author.id === authorId) ?? null;
      },
    },
    accounts: {
      ...accountRepository,
      async todo() {
        const counts = await accountRepository.todo();
        const reviews = await entries.listEditorial({ scope: "all", status: ["in_review"], limit: 1 });
        return { ...counts, reviews: reviews.total };
      },
    },
    audit: {
      async listAudit(query = {}) {
        context.requireActive(true);
        const rows = context.auditLog.filter(
          (event) =>
            (!query.objectType || event.objectType === query.objectType) &&
            (!query.objectId || event.objectId === query.objectId) &&
            (!query.action || event.action === query.action),
        );
        return paginate(rows, query.limit ?? 50, query.offset);
      },
    },
    community,
    chronicles: createMockChronicleRepository(chronicles, context, () => people.map((m) => m.id)),
    operations: { ready: async () => ({ ok: true, schema: "fixtures" }) },
  };
}
