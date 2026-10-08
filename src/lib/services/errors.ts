import type { Lang, Localized } from "@/lib/model/types";
import { ServiceError, type ServiceErrorCode } from "./contracts";

/*
 * One vocabulary for failures. The database raises a snake_case reason with a
 * SQLSTATE; adapters turn that into a ServiceError; routes answer with the
 * reason, an HTTP status and a sentence the interface can show as is. No
 * database text, stack or identifier reaches the browser.
 */

const SQLSTATE: Record<string, ServiceErrorCode> = {
  "42501": "forbidden",
  "40001": "conflict",
  "23505": "conflict",
  "22023": "invalid",
  "22P02": "invalid",
  "23514": "invalid",
  "23503": "invalid",
  P0002: "not_found",
  PGRST116: "not_found",
  PW429: "rate_limited",
};

/** A Supabase/PostgREST error as a ServiceError, keeping only the reason code. */
export function fromDatabaseError(error: { message?: string; code?: string; details?: string | null }): ServiceError {
  const code = (error.code ? SQLSTATE[error.code] : undefined) ?? "unavailable";
  const message = error.message ?? "";
  const reason = /^[a-z][a-z0-9_]*$/.test(message)
    ? message
    : code === "forbidden" && /permission denied/i.test(message)
      ? "forbidden"
      : code;
  // Detail is only kept for reasons whose detail is ours (lists of ids), never raw database text.
  const detail = reason === "assets_not_approved" ? (error.details ?? undefined) : undefined;
  return new ServiceError(code, reason, reason, detail);
}

export const HTTP_STATUS: Record<ServiceErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid: 422,
  rate_limited: 429,
  unavailable: 503,
};

/** What each reason means for the person who met it, and what to do next. */
const REASONS: Record<string, Localized> = {
  unauthenticated: { zh: "请先登录。", en: "Sign in to continue." },
  forbidden: { zh: "当前账号没有执行此操作的权限。", en: "This account may not do that." },
  invalid: { zh: "提交的内容不完整或格式不对。", en: "Some of what was sent is missing or malformed." },
  conflict: { zh: "内容已被他人更改，请刷新后再试。", en: "This changed in the meantime. Refresh and try again." },
  not_found: { zh: "找不到该对象，可能已被归档。", en: "Not found; it may have been archived." },
  rate_limited: { zh: "操作太频繁，请稍后再试。", en: "Too many requests. Wait a little and try again." },
  unavailable: { zh: "服务暂时不可用，请稍后重试。", en: "The service is unavailable. Try again shortly." },
  supabase_required: {
    zh: "此功能需要已配置的 Supabase 后端，本地演示数据不支持。",
    en: "This needs a configured Supabase backend; the local fixtures cannot do it.",
  },
  email_not_verified: { zh: "请先验证邮箱。", en: "Verify your email first." },
  verified_account_required: {
    zh: "需要已验证且未停用的账号。请验证邮箱，或联系管理员。",
    en: "This needs a verified, active account. Verify your email or contact an administrator.",
  },
  account_suspended: { zh: "账号已停用，无法执行写入操作。", en: "This account is suspended and cannot make changes." },
  account_required: { zh: "请先登录有效账号。", en: "Sign in with an active account." },
  admin_required: { zh: "需要管理员权限。", en: "Administrator access is required." },
  author_required: {
    zh: "编辑 Wiki 需要作者资格。请在账号页提交申请。",
    en: "Editing the wiki needs author status. Apply from your account page.",
  },
  entry_not_found: { zh: "条目不存在。", en: "No such entry." },
  entry_archived: { zh: "条目已归档，恢复后才能编辑。", en: "This entry is archived; restore it to edit." },
  revision_conflict: {
    zh: "条目在你打开后有了新修订。请刷新，确认最新内容后再操作。",
    en: "A newer revision was saved since you opened this. Refresh and check it first.",
  },
  invalid_transition: { zh: "条目当前状态不允许此操作。", en: "The entry's current state does not allow that." },
  review_pending: {
    zh: "条目正在审核，请先发布或退回，再回滚。",
    en: "A submission is waiting; publish or return it before rolling back.",
  },
  expected_revision_required: { zh: "请指明要处理的修订。", en: "Name the revision you reviewed." },
  reason_required: { zh: "请填写原因。", en: "Give a reason." },
  bilingual_incomplete: {
    zh: "提交需要中英文标题、摘要，以及正文中的 :::zh 与 :::en 块。",
    en: "A submission needs both titles, both summaries, and :::zh and :::en blocks in the body.",
  },
  assets_not_approved: {
    zh: "条目引用的图片尚未通过审核，请先在素材审核中批准。",
    en: "The entry uses images that are not approved yet; approve them in image review first.",
  },
  rollback_target_unpublished: {
    zh: "只能回滚到曾经公开过的修订。",
    en: "Only a revision that was once public can be rolled back to.",
  },
  revision_not_found: { zh: "修订不存在。", en: "No such revision." },
  title_required: { zh: "请至少填写一个标题。", en: "Give the entry a title." },
  title_too_long: { zh: "标题过长（最多 200 字）。", en: "The title is too long (200 characters at most)." },
  summary_too_long: { zh: "摘要过长（最多 2000 字）。", en: "The summary is too long (2000 characters at most)." },
  body_too_long: { zh: "正文过长。", en: "The body is too long." },
  invalid_category: { zh: "请选择一个有效的门类。", en: "Choose an active genus." },
  species_outside_genus: { zh: "物种学名必须属于所选的属。", en: "The species must belong to the chosen genus." },
  unknown_relation_target: { zh: "关系指向的条目不存在。", en: "A relation points at an entry that does not exist." },
  relation_to_self: { zh: "条目不能与自身建立关系。", en: "An entry cannot relate to itself." },
  relation_target_required: { zh: "关系缺少目标条目。", en: "A relation is missing its target." },
  unknown_hero_asset: { zh: "封面图片不存在或不可用。", en: "The cover image does not exist or is unavailable." },
  unknown_source: { zh: "引用的来源不存在。", en: "A cited source does not exist." },
  unknown_tag: { zh: "标签不存在。", en: "A tag does not exist." },
  unknown_contributor: { zh: "贡献者不存在。", en: "A contributor does not exist." },
  invalid_pending_tags: { zh: "新标签最多 20 个，每个不超过 40 字。", en: "At most 20 new tags of 40 characters each." },
  invalid_pending_sources: {
    zh: "新来源最多 20 条，每条不超过 500 字。",
    en: "At most 20 new sources of 500 characters each.",
  },
  slug_taken: { zh: "该地址已被使用。", en: "That address is taken." },
  invalid_slug: { zh: "地址只能包含小写字母、数字和连字符。", en: "Use lowercase letters, digits and hyphens." },
  unchanged_status: { zh: "状态没有变化，可能已被处理。", en: "Nothing changed; it may already be done." },
  last_admin: {
    zh: "这是最后一位有效管理员，不能被移除、停用或注销。",
    en: "This is the last active administrator; they cannot be removed, suspended or closed.",
  },
  cannot_change_own_status: { zh: "不能停用自己的账号。", en: "You cannot suspend your own account." },
  cannot_close_own_account: {
    zh: "管理员不能处理自己的注销，请由另一位管理员处理。",
    en: "Another administrator must process your own closure.",
  },
  account_closed: { zh: "账号已注销。", en: "The account is closed." },
  account_not_active: { zh: "账号未激活或未验证邮箱。", en: "The account is not active or not verified." },
  unchanged_role: { zh: "角色没有变化。", en: "The role is unchanged." },
  author_already_bound: { zh: "该作者已绑定到其他账号。", en: "That author is bound to another account." },
  member_already_bound: { zh: "该成员主页已绑定到其他账号。", en: "That member page is bound to another account." },
  member_author_mismatch: {
    zh: "成员主页署名的作者与账号的作者不一致。",
    en: "The page is attributed to a different author than the account's.",
  },
  admin_needs_author: {
    zh: "管理员必须保留作者身份，才能管理文章。",
    en: "An administrator keeps an author record to manage entries.",
  },
  author_not_found: { zh: "作者不存在。", en: "No such author." },
  member_not_found: { zh: "成员不存在。", en: "No such member." },
  profile_not_found: { zh: "账号不存在。", en: "No such account." },
  application_pending: { zh: "你已有一份待处理的申请。", en: "You already have an application waiting." },
  application_decided: { zh: "该申请已被处理。", en: "This application has already been decided." },
  application_not_found: { zh: "申请不存在。", en: "No such application." },
  nothing_to_bind: { zh: "批准时请至少选择作者或成员主页。", en: "Choose an author or a member page to approve." },
  invalid_author_handle: { zh: "作者代号只能包含小写字母、数字和连字符。", en: "Author handles use a-z, 0-9 and hyphens." },
  author_handle_taken: { zh: "作者代号已被使用。", en: "That author handle is taken." },
  invalid_member_handle: { zh: "主页地址只能包含小写字母、数字和连字符。", en: "Page handles use a-z, 0-9 and hyphens." },
  member_handle_taken: { zh: "主页地址已被使用。", en: "That page handle is taken." },
  invalid_display_name: { zh: "显示名需要 1–40 个字符。", en: "Display names need 1–40 characters." },
  invalid_statement: { zh: "请用 1–2000 字说明申请理由。", en: "Explain the application in 1–2000 characters." },
  forbidden_fields: { zh: "只有管理员可以修改这些字段。", en: "Only administrators may change those fields." },
  member_archived: { zh: "该主页已归档，暂时不能编辑。", en: "This page is archived and cannot be edited." },
  version_conflict: {
    zh: "内容已被他人保存过新版本，请刷新后再改。",
    en: "Someone saved a newer version. Refresh before editing.",
  },
  invalid_link_url: { zh: "请填写 http(s) 地址。", en: "Use an http(s) address." },
  invalid_link_name: { zh: "请填写 1–60 字的中英文名称。", en: "Give names of 1–60 characters in both languages." },
  invalid_link_description: { zh: "简介最多 240 字。", en: "Descriptions are 240 characters at most." },
  link_url_taken: { zh: "该地址已在友链中。", en: "That address is already listed." },
  link_incomplete: { zh: "请填写名称和地址。", en: "Give a name and an address." },
  link_not_found: { zh: "友链不存在。", en: "No such link." },
  chronicle_incomplete: { zh: "请填写日期、类型、标题与摘要。", en: "Give a date, kind, title and summary." },
  chronicle_not_found: { zh: "纪行记录不存在。", en: "No such record." },
  unknown_chronicle_host: { zh: "参与者中有不存在的成员。", en: "A participant is not a member." },
  invalid_chronicle_resources: {
    zh: "资源需要类型、双语标签和 http(s) 地址。",
    en: "Resources need a kind, both labels and an http(s) address.",
  },
  thread_locked: { zh: "该主题已锁定，不能回复。", en: "This thread is locked." },
  hide_thread_instead: { zh: "首帖不能单独隐藏，请隐藏整个主题。", en: "Hide the thread instead of its opening post." },
  thread_not_found: { zh: "主题不存在。", en: "No such thread." },
  post_not_found: { zh: "回复不存在。", en: "No such post." },
  invalid_thread: { zh: "标题 1–120 字，正文 1–8000 字。", en: "Titles 1–120 characters, bodies 1–8000." },
  invalid_post: { zh: "回复需要 1–8000 字。", en: "Replies need 1–8000 characters." },
  asset_not_found: { zh: "图片不存在。", en: "No such image." },
  asset_details_required: {
    zh: "批准前需要中英文替代文本、署名和许可。",
    en: "Approval needs alternative text in both languages, a credit and a licence.",
  },
  asset_in_published_entry: {
    zh: "该图片正被已发布条目使用，不能撤回批准。",
    en: "A published entry uses this image; it cannot be withdrawn.",
  },
  asset_already_approved: { zh: "已批准的图片只能由管理员修改。", en: "Only administrators change approved images." },
  invalid_asset_details: { zh: "图片说明过长或来源地址无效。", en: "Image details are too long or the source is invalid." },
  object_not_found: { zh: "上传的文件不存在，请重新上传。", en: "The uploaded file is missing; upload again." },
  unsupported_image_type: { zh: "只支持 JPEG、PNG、WebP、AVIF 或 GIF。", en: "Only JPEG, PNG, WebP, AVIF or GIF images." },
  image_too_large: { zh: "图片不能超过 15 MB。", en: "Images must be 15 MB or smaller." },
  unreadable_image: {
    zh: "无法读取这张图片，或像素超过 4000 万。",
    en: "This image cannot be read, or it has more than 40 million pixels.",
  },
  image_required: { zh: "请选择一张图片。", en: "Choose an image." },
  file_in_use: { zh: "该文件仍被引用，不能删除。", en: "That file is still referenced and cannot be removed." },
  upload_failed: { zh: "上传失败，文件未保存。请重试。", en: "The upload failed and nothing was kept. Try again." },
  invalid_draft_payload: { zh: "草稿内容为空或过大。", en: "The draft is empty or too large." },
  version_not_found: { zh: "版本不存在。", en: "No such version." },
  throttled: { zh: "请求太频繁，请稍后再试。", en: "Too many attempts. Wait a little and try again." },
  site_url_missing: {
    zh: "站点地址（PIONEER_SITE_URL）未配置，无法生成邮件链接。",
    en: "The site address (PIONEER_SITE_URL) is not configured, so email links cannot be made.",
  },
  invalid_email: { zh: "请输入有效的邮箱地址。", en: "Enter a valid email address." },
  invalid_password: { zh: "密码至少 8 个字符，两次输入需一致。", en: "Use matching passwords of at least 8 characters." },
  wrong_password: { zh: "当前密码不正确。", en: "The current password is incorrect." },
  same_email: { zh: "新邮箱与当前邮箱相同。", en: "That is already your email." },
  invalid_credentials: { zh: "邮箱或密码不正确。", en: "Email or password is incorrect." },
  link_expired: {
    zh: "链接已失效或已被使用。请重新发送邮件。",
    en: "This link has expired or was already used. Send a new one.",
  },
  invalid_payload: { zh: "请求格式不正确。", en: "The request was malformed." },
  cross_site_request: { zh: "请求来源无效，请从本站页面操作。", en: "The request did not come from this site." },
};

export function reasonText(reason: string, lang: Lang, fallback: ServiceErrorCode = "unavailable"): string {
  return (REASONS[reason] ?? REASONS[fallback] ?? REASONS.unavailable)[lang];
}

export function hasReason(reason: string): boolean {
  return Object.hasOwn(REASONS, reason);
}

/** The JSON body a route answers a failure with. */
export function errorBody(error: ServiceError, lang: Lang) {
  return {
    error: {
      code: error.code,
      reason: error.reason,
      message: reasonText(error.reason, lang, error.code),
      ...(error.detail ? { detail: error.detail } : {}),
    },
  };
}

/** Any thrown value as a ServiceError; unexpected ones become "unavailable". */
export function asServiceError(error: unknown, fallback: ServiceErrorCode = "unavailable"): ServiceError {
  if (error instanceof ServiceError) return error;
  // By shape too: in development the service graph outlives module reloads, so its errors may fail instanceof.
  if (error instanceof Error && error.name === "ServiceError" && typeof (error as ServiceError).code === "string") {
    const e = error as ServiceError;
    return new ServiceError(e.code, e.message, e.reason ?? e.message, e.detail);
  }
  if (error instanceof SyntaxError) return new ServiceError("invalid", "invalid_payload");
  return new ServiceError(fallback, fallback);
}
