import { ServiceError, type NewPostInput, type NewThreadInput } from "@/lib/services/contracts";

function clean(value: unknown, limit: number, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit)
    throw new ServiceError("invalid", `Invalid ${field}`);
  return value.trim();
}
export function validatePost(input: NewPostInput): NewPostInput {
  return { ...input, body: clean(input.body, 8000, "body"), authorName: clean(input.authorName, 40, "name") };
}
export function validateThread(input: NewThreadInput): NewThreadInput {
  if (!["general", "help", "showcase", "meta"].includes(input.category))
    throw new ServiceError("invalid", "Unknown category");
  return {
    ...validatePost({ ...input, threadId: "" }),
    title: clean(input.title, 120, "title"),
    category: input.category,
  };
}
