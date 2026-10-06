import { authors, sources, tags } from "@/mock/people";
import { assets } from "@/mock/assets";
import { createMockEntryRepository } from "./repository";
import { createMockCommunityRepository } from "./community";
import { createMockSearchAdapter } from "@/lib/search/adapter";
import type { WikiServices } from "@/lib/services/contracts";
import type { Account } from "@/lib/model/types";

export function createMockServices(): WikiServices {
  const qingkong = authors.find((author) => author.id === "a-qingkong") ?? null;
  const account: Account | null = qingkong
    ? {
        id: qingkong.id,
        email: "qingkong@example.test",
        handle: qingkong.handle,
        name: qingkong.name,
        sigil: qingkong.sigil,
        role: "admin",
        emailVerified: true,
        authorId: qingkong.id,
      }
    : null;
  return {
    entries: createMockEntryRepository(),
    references: {
      listAuthors: async () => authors,
      listSources: async () => sources,
      listTags: async () => tags,
      listAssets: async () => assets,
      getAsset: async (id) => assets.find((asset) => asset.id === id) ?? null,
    },
    search: createMockSearchAdapter(),
    auth: { getCurrentAccount: async () => account, getCurrentUser: async () => qingkong },
    community: createMockCommunityRepository(),
  };
}
