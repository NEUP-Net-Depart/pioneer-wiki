import type { MemberPatch } from "@/lib/model/types";
import { BORDERS, EMBLEMS, INKS } from "@/lib/model/vocab";
import { ServiceError } from "@/lib/services/contracts";
import { validateProjects } from "./project-validation";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ServiceError("invalid", "Invalid member edit");
  return value as Record<string, unknown>;
}
function clean(value: unknown, max: number, field: string, required = true): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()))
    throw new ServiceError("invalid", `Invalid ${field}`);
  return value.trim();
}
function localized(value: unknown, max: number, field: string) {
  const input = record(value);
  return { zh: clean(input.zh, max, `${field} (zh)`), en: clean(input.en, max, `${field} (en)`) };
}
export function memberLink(value: unknown): { label: string; url: string } {
  const input = record(value);
  const url = clean(input.url, 300, "link URL");
  if (/[\u0000-\u0020\u007f]/.test(url) || !/^(https?:\/\/|mailto:)/i.test(url))
    throw new ServiceError("invalid", "Use http(s) or mailto links");
  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:", "mailto:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      (parsed.protocol === "mailto:" ? !parsed.pathname : !parsed.hostname)
    )
      throw new Error("Invalid URL");
  } catch {
    throw new ServiceError("invalid", "Invalid link URL");
  }
  return { label: clean(input.label, 32, "link label"), url };
}
export function readMemberLinks(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((link) => {
    try {
      return [memberLink(link)];
    } catch {
      return [];
    }
  });
}
export function memberGithub(value: unknown): string | undefined {
  if (value === null) return undefined;
  const login = clean(value, 39, "GitHub login", false);
  if (login && !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) throw new ServiceError("invalid", "Invalid GitHub login");
  return login || undefined;
}
export function readMemberGithub(value: unknown): string | undefined {
  try {
    return memberGithub(value ?? null);
  } catch {
    return undefined;
  }
}

/** Normalize unknown HTTP payloads before either backend mutates member data. */
export function validateMemberPatch(value: unknown): MemberPatch {
  const input = record(value);
  const patch: MemberPatch = {};
  if (input.projects !== undefined) patch.projects = validateProjects(input.projects);
  if (input.name !== undefined) patch.name = localized(input.name, 40, "name");
  if (input.role !== undefined) patch.role = localized(input.role, 40, "role");
  if (input.bio !== undefined) patch.bio = localized(input.bio, 160, "bio");
  if (input.about !== undefined) {
    if (typeof input.about !== "string" || input.about.length > 20000)
      throw new ServiceError("invalid", "Invalid about");
    patch.about = input.about;
  }
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || input.links.length > 8) throw new ServiceError("invalid", "At most 8 links");
    patch.links = input.links.map(memberLink);
  }
  if (input.github !== undefined) patch.github = memberGithub(input.github) ?? null;
  if (input.plate !== undefined) {
    const plate = record(input.plate);
    const next: NonNullable<MemberPatch["plate"]> = {};
    if (plate.emblem !== undefined) {
      if (!EMBLEMS.some((item) => item.id === plate.emblem)) throw new ServiceError("invalid", "Unknown emblem");
      next.emblem = String(plate.emblem);
    }
    if (plate.ink !== undefined) {
      if (typeof plate.ink !== "string" || !Object.hasOwn(INKS, plate.ink))
        throw new ServiceError("invalid", "Unknown ink");
      next.ink = plate.ink as typeof next.ink;
    }
    if (plate.border !== undefined) {
      if (typeof plate.border !== "string" || !Object.hasOwn(BORDERS, plate.border))
        throw new ServiceError("invalid", "Unknown border");
      next.border = plate.border as typeof next.border;
    }
    if (plate.motto !== undefined) next.motto = clean(plate.motto, 48, "motto", false);
    patch.plate = next;
  }
  if (input.coverPrint !== undefined) {
    if (input.coverPrint !== "original" && input.coverPrint !== "ink")
      throw new ServiceError("invalid", "Unknown print mode");
    patch.coverPrint = input.coverPrint;
  }
  return patch;
}
