import "server-only";
import { requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import type { Account, Member } from "@/lib/model/types";

/**
 * A member page may be edited by the account bound to it, or by an
 * administrator. The database checks the same rule on every write; this
 * answers early, with the member, for handlers that do more than one step.
 */
export async function editableMember(handle: string): Promise<{ account: Account; member: Member; admin: boolean }> {
  const account = await requireAccount();
  const member = await getServices().community.getMember(handle, { includeArchived: true });
  if (!member) throw new ServiceError("not_found", "member_not_found");
  const admin = account.role === "admin";
  if (!admin && account.memberId !== member.id) throw new ServiceError("forbidden", "forbidden");
  if (!admin && member.archivedAt) throw new ServiceError("conflict", "member_archived");
  return { account, member, admin };
}
