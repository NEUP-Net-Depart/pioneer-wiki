import type {
  Asset,
  Account,
  AccountRecord,
  AccountStatus,
  ApplicationKind,
  ApplicationStatus,
  AssetRecord,
  AssetReviewStatus,
  AuditEvent,
  Author,
  Category,
  Chronicle,
  ChronicleDetail,
  ChronicleKind,
  ChronicleResource,
  ContentVersion,
  DomainId,
  EditorialEntry,
  Entry,
  EntryId,
  EntrySlug,
  EntrySummary,
  ForumCategory,
  ForumPost,
  ForumThread,
  FriendLink,
  IdentityApplication,
  Lang,
  Localized,
  Member,
  MemberCover,
  MemberPatch,
  Page,
  Relation,
  ReviewState,
  Revision,
  RevisionSnapshot,
  Scale,
  Source,
  Tag,
  EntryMetadata,
  Family,
  TaxonKind,
  TaxonLink,
  TaxonSnapshot,
  TaxonVersion,
} from "@/lib/model/types";
import type { EncodedImage } from "@/lib/media/store";

/*
 * Service contracts. Pages and components talk to these interfaces only.
 * The mock implementations live in `./mock`; a CMS, search engine or auth
 * provider replaces them by implementing the same interface and being
 * selected in `./index.ts` (env `PIONEER_DATA_SOURCE`).
 *
 * Error contract: methods resolve `null` / `[]` for "not found"; they throw
 * `ServiceError` for everything else (unavailable, conflict, forbidden). The
 * `reason` is a stable snake_case code (e.g. "revision_conflict") that the
 * interface turns into bilingual text; see `./errors`.
 */

export type ServiceErrorCode =
  "unavailable" | "conflict" | "forbidden" | "invalid" | "not_found" | "rate_limited" | "unauthenticated";

export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
    /** Stable machine-readable cause; defaults to the message when it is already a code. */
    readonly reason: string = /^[a-z][a-z0-9_]*$/.test(message) ? message : code,
    /** Safe extra detail, e.g. the ids of images that still need review. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// ── Entries, revisions, relations ───────────────────────────────────────────

/**
 * Public listings: published, unarchived entries only, whoever is signed in.
 * `status` is accepted for older callers; anything but "published" matches nothing.
 */
export interface EntryQuery {
  status?: ReviewState[];
  /** Entries whose published genus is one of these. */
  categoryId?: string[];
  /** Entries whose published genus belongs to one of these families. */
  familyId?: string[];
  /** Entries that list one of these genera as a cross-genus reference. */
  auxiliaryCategoryId?: string[];
  /** @deprecated The ten phyla before the family → genus catalogue; kept for older callers. */
  domain?: DomainId[];
  scale?: Scale[];
  featured?: boolean;
  /** Default "updated" (newest first). */
  sort?: "updated" | "created";
  limit?: number;
}

export interface DraftInput {
  /** Omit to create a new entry. */
  entryId?: EntryId;
  /**
   * Genus of a new entry; required when creating unless `metadata.categoryId` carries it.
   * Existing entries are refiled through `metadata`, which belongs to the revision.
   */
  categoryId?: string;
  /** @deprecated Phylum of a new entry before the family → genus catalogue. */
  domain?: DomainId;
  title: Localized;
  summary: Localized;
  body: string;
  note: string;
  authorId: string;
  /** Revision the editor started from; used for optimistic concurrency. */
  baseRevision?: number;
  metadata?: EntryMetadata;
}

/** A saved revision, and whether saving it withdrew a submission that was waiting for review. */
export type SavedRevision = Revision & { withdrewReview?: boolean; slug?: EntrySlug };

export type ReviewAction = "submit" | "withdraw" | "return" | "publish" | "rollback";

export interface ReviewTransitionInput {
  entryId: EntryId;
  action: ReviewAction;
  actorId: string;
  /**
   * The latest revision the caller looked at. Required for "return" and
   * "publish": anything written since is a conflict, never published unread.
   */
  expectedRevision?: number;
  /** Required for "rollback": a published revision whose content becomes current again. */
  targetRevisionId?: string;
  /** The edit note, or for "return" the reason the author will read. */
  note?: string;
}

export interface EditorialQuery {
  /** "mine": the signed-in author's entries; "all": every entry (administrators). */
  scope: "mine" | "all";
  text?: string;
  /** Workflow states; also "returned" (a draft sent back) and "unpublished" (never published). */
  status?: Array<ReviewState | "returned" | "unpublished">;
  /** Default "active". */
  view?: "active" | "archived" | "all";
  limit?: number;
  offset?: number;
}

/** The editor's and the reviewer's view of one entry: its workflow row, latest and public revisions. */
export interface EditorialPacket {
  entry: EditorialEntry;
  latest: RevisionSnapshot;
  published: RevisionSnapshot | null;
}

/** The editor's autosaved working copy, kept per account and entry. */
export interface WorkingDraft {
  id: string;
  entryId?: EntryId;
  baseRevision?: number;
  payload: Record<string, unknown>;
  version: number;
  savedAt: string;
}

export interface WorkingDraftSave {
  id?: string;
  entryId?: EntryId;
  baseRevision?: number;
  payload: Record<string, unknown>;
  /** The version this editor last loaded or saved. A newer one is returned, not overwritten. */
  knownVersion?: number;
}

export type WorkingDraftResult =
  | { conflict: false; id: string; version: number; savedAt: string }
  | { conflict: true; id: string; version: number; savedAt: string; payload: Record<string, unknown> };

export interface EntryRepository {
  /** Published, unarchived entries. */
  listEntries(query?: EntryQuery): Promise<EntrySummary[]>;
  /** The published entry by its slug or a former slug; null when unpublished or archived. */
  getEntry(slug: EntrySlug): Promise<Entry | null>;
  getEntryById(id: EntryId): Promise<Entry | null>;
  /**
   * Newest first. "public" (default) lists only revisions readers may open;
   * "editorial" lists every revision the caller may see.
   */
  listRevisions(entryId: EntryId, options?: { scope?: "public" | "editorial" }): Promise<Revision[]>;
  getRevisionBody(revisionId: string): Promise<string | null>;
  /** The whole snapshot of a revision the caller may see. */
  getRevision(revisionId: string): Promise<RevisionSnapshot | null>;
  /** All relations touching the entry (either direction), or every relation, between public entries. */
  listRelations(entryId?: EntryId): Promise<Relation[]>;
  /** Editorial lists: the latest revision's title and the workflow state. */
  listEditorial(query: EditorialQuery): Promise<Page<EditorialEntry>>;
  /** By id or current slug; null when the entry does not exist or the caller may not edit it. */
  getEditorial(entryIdOrSlug: string): Promise<EditorialPacket | null>;
  saveDraft(input: DraftInput): Promise<SavedRevision>;
  transition(input: ReviewTransitionInput): Promise<Revision>;
  /** Administrators only. Archived entries leave every public read; their history stays. */
  setArchived(
    entryId: EntryId,
    archived: boolean,
    reason?: string,
  ): Promise<{ id: EntryId; slug: EntrySlug; archivedAt?: string }>;
  /** Administrators only. The old slug keeps resolving. */
  renameSlug(entryId: EntryId, slug: EntrySlug): Promise<{ slug: EntrySlug; formerSlugs: EntrySlug[] }>;
  getWorkingDraft(query: { id?: string; entryId?: EntryId }): Promise<WorkingDraft | null>;
  saveWorkingDraft(input: WorkingDraftSave): Promise<WorkingDraftResult>;
  deleteWorkingDraft(id: string): Promise<void>;
}

// ── Reference data and images ───────────────────────────────────────────────

export interface AssetDetails {
  altZh?: string;
  altEn?: string;
  captionZh?: string;
  captionEn?: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
}

export interface AssetQuery {
  status?: AssetReviewStatus[];
  text?: string;
  limit?: number;
  offset?: number;
}

export interface ReferenceRepository {
  listAuthors(): Promise<Author[]>;
  listSources(): Promise<Source[]>;
  listTags(): Promise<Tag[]>;
  /** An image the caller may see: approved, or their own, or any for administrators. */
  getAsset(id: string): Promise<Asset | null>;
  /** Images an editor may place: approved ones, and the caller's own pending ones. */
  listAssets(): Promise<Asset[]>;
  /** Administrators: images with their review state and where they are used. */
  listAssetsForReview(query?: AssetQuery): Promise<Page<AssetRecord>>;
  reviewAsset(id: string, decision: AssetReviewStatus, note?: string, details?: AssetDetails): Promise<AssetRecord>;
  /** The owner describes a pending or rejected image (a rejected one returns to pending). */
  updateAssetDetails(id: string, details: AssetDetails): Promise<Asset>;
  /** Stored files nothing references (administrators). */
  listOrphanFiles(): Promise<Array<{ bucket: string; name: string; createdAt: string; size?: number }>>;
  /** Administrators remove a file nothing references. */
  removeOrphanFile(bucket: string, name: string): Promise<void>;
  /**
   * Stores a re-encoded article image and records it as pending review. If
   * the record cannot be written the stored file is removed again.
   */
  uploadEntryAsset(image: EncodedImage, details: AssetDetails): Promise<Asset>;
  /** The bytes of an image the caller may see; `cacheable` when it is approved (public). */
  readAssetFile(id: string): Promise<{ data: Buffer; cacheable: boolean } | null>;
}

// ── Taxonomy: families and genera ───────────────────────────────────────────

export interface TaxonomyQuery {
  /** Include archived taxa (administration only). Default false. */
  includeArchived?: boolean;
}

/** What an administrator may change on a family or a genus. The id never changes. */
export interface TaxonPatch {
  slug?: string;
  name?: Localized;
  scientificName?: string;
  taxonNameZh?: string | null;
  intro?: Localized;
  essay?: string;
  emblemAssetId?: string | null;
  links?: TaxonLink[];
  leadId?: string | null;
  collaboratorIds?: string[];
  sortOrder?: number;
  /** Genus only: move it to another family. */
  familyId?: string;
  /** Genus only. */
  representativeSlug?: string | null;
}

export interface TaxonSaveInput {
  kind: TaxonKind;
  /** Omit to create a new taxon; `patch` must then carry slug, name and scientific name (and familyId for a genus). */
  id?: string;
  patch: TaxonPatch;
  note: string;
  actorId?: string;
  /** Version the editor started from; used for optimistic concurrency. */
  baseVersion?: number;
}

/**
 * The catalogue. Saving is administrator-only and public at once, but every
 * change is kept as a version. There is deliberately no delete: a taxon can be
 * archived, which hides it from readers, and restored.
 */
export interface TaxonomyRepository {
  /** Sorted by sortOrder. */
  listFamilies(query?: TaxonomyQuery): Promise<Family[]>;
  /** Sorted by family order, then sortOrder. */
  listCategories(query?: TaxonomyQuery & { familyId?: string }): Promise<Category[]>;
  /** By slug or a former slug; archived taxa resolve only with includeArchived. */
  getFamily(slug: string, query?: TaxonomyQuery): Promise<Family | null>;
  getCategory(slug: string, query?: TaxonomyQuery): Promise<Category | null>;
  /** Throws ServiceError("invalid") for bad values, ("conflict") for a stale baseVersion or a taken slug. */
  saveTaxon(input: TaxonSaveInput): Promise<TaxonVersion>;
  /** Archiving a family requires every genus in it to be archived first. */
  archiveTaxon(kind: TaxonKind, id: string, actorId?: string, note?: string): Promise<TaxonVersion>;
  restoreTaxon(kind: TaxonKind, id: string, actorId?: string, note?: string): Promise<TaxonVersion>;
  /** Newest first. */
  listTaxonVersions(kind: TaxonKind, id: string): Promise<TaxonVersion[]>;
  /** Makes an old version's content current again, as a new version. */
  revertTaxon(kind: TaxonKind, id: string, versionNumber: number, actorId?: string): Promise<TaxonVersion>;
  /** Published name snapshots, keyed by scientific name; a name not yet verified is absent. */
  snapshots(scientificNames: string[]): Promise<Record<string, TaxonSnapshot>>;
}

// ── Search ──────────────────────────────────────────────────────────────────

export type SearchField = "id" | "title" | "summary" | "body" | "tags" | "author" | "source";

export interface SearchFilters {
  familyId?: string[];
  categoryId?: string[];
  /** @deprecated */
  domain?: DomainId[];
  scale?: Scale[];
  status?: ReviewState[];
  lang?: Lang[];
  author?: string[];
}

export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchSnippet {
  field: SearchField;
  text: string;
  /** [start, end) character ranges inside `text` to highlight. */
  highlights: Array<[number, number]>;
}

export interface SearchHit {
  entry: EntrySummary;
  /** Family of the entry's genus, so results can be printed in the family's ink. */
  familyId?: string;
  score: number;
  matchedFields: SearchField[];
  snippet: SearchSnippet | null;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  /** Counts per filter value over the text-matched set, before filters apply. */
  facets: {
    family: Partial<Record<string, number>>;
    category: Partial<Record<string, number>>;
    domain: Partial<Record<DomainId, number>>;
    scale: Partial<Record<Scale, number>>;
    status: Partial<Record<ReviewState, number>>;
    lang: Partial<Record<Lang, number>>;
  };
}

/** Searches published entries only, for every reader. */
export interface SearchAdapter {
  search(query: SearchQuery): Promise<SearchResult>;
}

// ── Identity ────────────────────────────────────────────────────────────────

export interface AuthAdapter {
  /** The signed-in account, including accounts that have no wiki author binding yet. */
  getCurrentAccount(): Promise<Account | null>;
  /** The signed-in wiki author, or null for an anonymous/unbound reader. */
  getCurrentUser(): Promise<Author | null>;
}

export interface AccountQuery {
  text?: string;
  status?: AccountStatus[];
  role?: Array<Account["role"]>;
  /** closure: closure requested; unverified; bound / unbound to an author or page; applicant: pending application. */
  flag?: "closure" | "unverified" | "bound" | "unbound" | "applicant";
  limit?: number;
  offset?: number;
}

/** How an application's approval provides an author or a member page: an existing record, or a new one. */
export type IdentityChoice =
  | { mode: "existing"; id: string }
  | {
      mode: "create";
      handle: string;
      name: Localized;
      affiliation?: Localized;
      role?: Localized;
      bio?: Localized;
    };

/** Counts on the administrators' desk: only work that needs someone. */
export interface AdminTodo {
  reviews: number;
  applications: number;
  closures: number;
  assets: number;
  suspended: number;
}

/**
 * Accounts, applications and the bindings between accounts, authors and
 * member pages. Self-service methods act on the signed-in account; the rest
 * are administrators' and are audited where they are applied.
 */
export interface AccountRepository {
  updateOwnProfile(name: Localized): Promise<Localized>;
  requestClosure(reason?: string): Promise<{ requestedAt: string | null }>;
  cancelClosure(): Promise<void>;
  listOwnApplications(): Promise<IdentityApplication[]>;
  submitApplication(input: { kind: ApplicationKind; statement: string; handle?: string }): Promise<IdentityApplication>;
  withdrawApplication(id: string): Promise<IdentityApplication>;

  todo(): Promise<AdminTodo>;
  listAccounts(query?: AccountQuery): Promise<Page<AccountRecord>>;
  setRole(id: string, role: Account["role"], reason?: string): Promise<void>;
  setStatus(id: string, status: Exclude<AccountStatus, "closed">, reason?: string): Promise<void>;
  /** Absent keys keep a binding; null unbinds. */
  setIdentity(
    id: string,
    patch: { authorId?: string | null; memberId?: string | null },
    reason?: string,
  ): Promise<void>;
  closeAccount(id: string, note?: string): Promise<void>;
  listApplications(query?: {
    status?: ApplicationStatus[];
    limit?: number;
    offset?: number;
  }): Promise<Page<IdentityApplication>>;
  decideApplication(
    id: string,
    decision: "approved" | "rejected",
    input: { reason?: string; author?: IdentityChoice | null; member?: IdentityChoice | null },
  ): Promise<IdentityApplication>;
}

export interface AuditQuery {
  objectType?: string;
  objectId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface AuditRepository {
  listAudit(query?: AuditQuery): Promise<Page<AuditEvent>>;
}

// ── Community: links, members, forum ────────────────────────────────────────

export interface NewThreadInput {
  title: string;
  body: string;
  category: ForumCategory;
  /** Ignored by the database backend, which derives the signature from the session. */
  authorName: string;
  memberId?: string;
}

export interface NewPostInput {
  threadId: string;
  body: string;
  authorName: string;
  memberId?: string;
}

export interface LinkPatch {
  name?: Localized;
  url?: string;
  description?: Localized;
  emblem?: string;
  since?: string;
  sortOrder?: number;
  sample?: boolean;
}

/** What administrators may set on a member page beyond what its owner may. */
export interface MemberAdminPatch extends MemberPatch {
  handle?: string;
  joined?: string;
  sample?: boolean;
  authorId?: string | null;
}

export interface MemberCreateInput {
  handle: string;
  name: Localized;
  role?: Localized;
  bio?: Localized;
  authorId?: string;
  plate?: { emblem?: string; ink?: string; border?: string; motto?: string };
}

export type ArchiveView = "active" | "archived" | "all";

export interface CommunityRepository {
  /** Charting order (joining date, then id). Archived links only with view "archived"/"all" (administrators). */
  listLinks(query?: { view?: ArchiveView }): Promise<FriendLink[]>;
  saveLink(id: string | null, patch: LinkPatch, baseVersion?: number): Promise<FriendLink>;
  setLinkArchived(id: string, archived: boolean, reason?: string): Promise<FriendLink>;
  listMembers(query?: { view?: ArchiveView }): Promise<Member[]>;
  /** By handle or a former handle. Archived pages resolve only for their owner and administrators with includeArchived. */
  getMember(handle: string, query?: { includeArchived?: boolean }): Promise<Member | null>;
  /** Throws ServiceError("invalid") for bad values; resolves null when the member does not exist. */
  updateMember(handle: string, patch: MemberAdminPatch, baseVersion?: number): Promise<Member | null>;
  /** Sets (or with null, removes) the member's large page image. */
  setMemberCover(handle: string, cover: MemberCover | null): Promise<Member | null>;
  /**
   * Stores a new page image and puts it on the page; the previous file is
   * removed only after the page points at the new one.
   */
  uploadMemberCover(handle: string, image: EncodedImage, print: MemberCover["print"]): Promise<Member>;
  removeMemberCover(handle: string): Promise<Member>;
  /** A locally stored page image (fixtures backend), by its object name. */
  readMemberImage(name: string): Promise<Buffer | null>;
  createMember(input: MemberCreateInput): Promise<Member>;
  setMemberArchived(handle: string, archived: boolean, reason?: string): Promise<Member>;
  listVersions(kind: ContentVersion["kind"], objectId: string): Promise<ContentVersion[]>;
  restoreVersion(kind: ContentVersion["kind"], objectId: string, number: number): Promise<void>;
  /** Every forum post the member wrote, newest first, with its thread. */
  listPostsBy(memberId: string): Promise<Array<{ post: ForumPost; thread: ForumThread }>>;
  /** Most recently active first. View other than "public" is for administrators. */
  listThreads(query?: {
    category?: ForumCategory;
    limit?: number;
    offset?: number;
    view?: "public" | "hidden" | "locked" | "all";
  }): Promise<ForumThread[]>;
  /** The thread and its posts, oldest first; null when it does not exist (or is hidden, for readers). */
  getThread(
    id: string,
    query?: { includeHidden?: boolean },
  ): Promise<{ thread: ForumThread; posts: ForumPost[] } | null>;
  /** Throws ServiceError("invalid") when title/body are empty or too long. */
  createThread(input: NewThreadInput): Promise<ForumThread>;
  /** Throws ServiceError("invalid") for an empty body; resolves null when the thread does not exist. */
  reply(input: NewPostInput): Promise<ForumPost | null>;
  moderateThread(id: string, action: "hide" | "restore" | "lock" | "unlock", reason?: string): Promise<ForumThread>;
  moderatePost(id: string, action: "hide" | "restore", reason?: string): Promise<ForumPost>;
}

export interface OperationsAdapter {
  /** Whether the data store answers and has the schema this build expects. */
  ready(): Promise<{ ok: boolean; schema?: string; reason?: string }>;
}

export interface WikiServices {
  entries: EntryRepository;
  taxonomy: TaxonomyRepository;
  references: ReferenceRepository;
  search: SearchAdapter;
  auth: AuthAdapter;
  accounts: AccountRepository;
  audit: AuditRepository;
  community: CommunityRepository;
  chronicles: ChronicleRepository;
  operations: OperationsAdapter;
}

// ── 纪行: the society's annals ──────────────────────────────────────────────

export interface ChronicleQuery {
  kind?: ChronicleKind[];
  year?: number;
  /** Records a member hosted or took part in (a member id, matched against `hostIds`). */
  member?: string;
  /**
   * Words to find: a literal, case-insensitive match against both languages'
   * titles and summaries and the account, whatever the reader's language.
   */
  q?: string;
  /** Applied after every filter, so a later page or a count never misses an older match. */
  limit?: number;
  offset?: number;
}

/** What the whole archive offers to browse by — never read off one page of results. */
export interface ChronicleFacets {
  total: number;
  /** How many of them are placeholder records. */
  samples: number;
  /** Newest first. */
  years: number[];
  /** In vocabulary order. */
  kinds: ChronicleKind[];
  memberIds: string[];
}

export interface ChroniclePatch {
  date?: string;
  kind?: ChronicleKind;
  title?: Localized;
  summary?: Localized;
  body?: string | null;
  hostIds?: string[];
  resources?: ChronicleResource[];
  tags?: string[];
  sample?: boolean;
}

export interface ChronicleRepository {
  /** Newest first: date descending, then register number descending. Unarchived records only. */
  listChronicles(query?: ChronicleQuery): Promise<Chronicle[]>;
  /** How many records match the filters, ignoring `limit` and `offset`. */
  countChronicles(query?: ChronicleQuery): Promise<number>;
  chronicleFacets(): Promise<ChronicleFacets>;
  /** The records either side of one in the full register, whatever list the reader came from. */
  adjacentChronicles(id: string): Promise<{ older: Chronicle | null; newer: Chronicle | null }>;
  /** The record with its optional account; null when it does not exist or is archived (unless includeArchived, administrators). */
  getChronicle(id: string, query?: { includeArchived?: boolean }): Promise<ChronicleDetail | null>;
  /** Administrators: every record, archived ones by view. */
  listForAdmin(query?: {
    view?: ArchiveView;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ChronicleDetail>>;
  saveChronicle(id: string | null, patch: ChroniclePatch, baseVersion?: number): Promise<ChronicleDetail>;
  setChronicleArchived(id: string, archived: boolean, reason?: string): Promise<ChronicleDetail>;
}
