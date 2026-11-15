import { desc, asc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  milestones,
  photos,
  stories,
  guests,
  expenses,
  appSettings,
  studioCreations,
} from './schema.ts';
import {
  INITIAL_STORY_MILESTONES,
  INITIAL_ALBUM_PHOTOS,
  INITIAL_STORIES,
  INITIAL_GUESTS,
  INITIAL_EXPENSES,
  INITIAL_WEDDING_DETAILS,
} from '../data/weddingData.ts';
import type {
  StoryMilestone,
  AlbumPhoto,
  StoryMoment,
  Guest,
  Expense,
} from '../types/wedding.ts';

let seedPromise: Promise<void> | null = null;

/**
 * Lazily seeds Cloud SQL on the first real HTTP request if tables are empty.
 * Never executes at module startup time.
 */
export async function ensureWeddingSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const existingGuests = await db.select({ id: guests.id }).from(guests).limit(1);
      if (existingGuests.length === 0) {
        await db
          .insert(guests)
          .values(
            INITIAL_GUESTS.map((g) => ({
              id: g.id,
              name: g.name,
              email: g.email,
              phone: g.phone || null,
              status: g.status,
              tableNumber: g.tableNumber || 1,
              dietary: g.dietary,
              hasPlusOne: g.hasPlusOne,
              plusOneName: g.plusOneName || null,
              plusOneDietary: g.plusOneDietary || null,
              attendingCeremony: g.attendingCeremony,
              attendingReception: g.attendingReception,
              notes: g.notes || null,
              updatedAt: g.updatedAt,
            }))
          )
          .onConflictDoNothing();
      }

      const existingMilestones = await db
        .select({ id: milestones.id })
        .from(milestones)
        .limit(1);
      if (existingMilestones.length === 0) {
        await db
          .insert(milestones)
          .values(
            INITIAL_STORY_MILESTONES.map((m, idx) => ({
              id: m.id,
              title: m.title,
              date: m.date,
              location: m.location,
              description: m.description,
              quote: m.quote || null,
              imageUrl: m.imageUrl,
              category: m.category,
              sortOrder: idx,
            }))
          )
          .onConflictDoNothing();
      }

      const existingPhotos = await db.select({ id: photos.id }).from(photos).limit(1);
      if (existingPhotos.length === 0) {
        await db
          .insert(photos)
          .values(
            INITIAL_ALBUM_PHOTOS.map((p) => ({
              id: p.id,
              uploaderName: p.uploaderName,
              uploaderRole: p.uploaderRole,
              uploaderUid: null,
              imageUrl: p.imageUrl,
              caption: p.caption,
              timestampLabel: p.timestamp,
              likesCount: p.likesCount,
              isLiked: p.isLiked,
              tags: p.tags,
            }))
          )
          .onConflictDoNothing();
      }

      const existingStories = await db.select({ id: stories.id }).from(stories).limit(1);
      if (existingStories.length === 0) {
        await db
          .insert(stories)
          .values(
            INITIAL_STORIES.map((s) => ({
              id: s.id,
              userName: s.userName,
              userRole: s.userRole,
              mediaUrl: s.mediaUrl,
              text: s.text || null,
              createdAtIso: s.createdAt,
              expiresAtIso: s.expiresAt,
              viewed: s.viewed,
            }))
          )
          .onConflictDoNothing();
      }

      const existingExpenses = await db
        .select({ id: expenses.id })
        .from(expenses)
        .limit(1);
      if (existingExpenses.length === 0) {
        await db
          .insert(expenses)
          .values(
            INITIAL_EXPENSES.map((e) => ({
              id: e.id,
              title: e.title,
              category: e.category,
              vendorName: e.vendorName,
              estimatedCost: e.estimatedCost,
              actualCost: e.actualCost,
              paidAmount: e.paidAmount,
              dueDate: e.dueDate,
              isPaid: e.isPaid,
              notes: e.notes || null,
            }))
          )
          .onConflictDoNothing();
      }

      const budgetSetting = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, 'totalBudget'))
        .limit(1);
      if (budgetSetting.length === 0) {
        await db
          .insert(appSettings)
          .values([
            { key: 'totalBudget', value: '75000' },
            {
              key: 'vowsExcerpt',
              value:
                INITIAL_WEDDING_DETAILS.couple.vowsExcerpt ||
                'I choose you today and all our tomorrows.',
            },
          ])
          .onConflictDoNothing();
      }
    } catch (error) {
      seedPromise = null;
      throw error;
    }
  })();

  return seedPromise;
}

export async function getWeddingBootstrap() {
  try {
    await ensureWeddingSeeded();

    const [
      milestoneRows,
      photoRows,
      storyRows,
      guestRows,
      expenseRows,
      settingRows,
      creationRows,
    ] = await Promise.all([
      db.select().from(milestones).orderBy(asc(milestones.sortOrder), desc(milestones.createdAt)),
      db.select().from(photos).orderBy(desc(photos.createdAt)),
      db.select().from(stories).orderBy(desc(stories.createdAt)),
      db.select().from(guests).orderBy(asc(guests.name)),
      db.select().from(expenses).orderBy(asc(expenses.dueDate)),
      db.select().from(appSettings),
      db.select().from(studioCreations).orderBy(desc(studioCreations.createdAt)).limit(20),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settingRows) {
      settingsMap[s.key] = s.value;
    }

    return {
      milestones: milestoneRows.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        location: m.location,
        description: m.description,
        quote: m.quote || undefined,
        imageUrl: m.imageUrl,
        category: m.category as StoryMilestone['category'],
      })),
      photos: photoRows.map((p) => ({
        id: p.id,
        uploaderName: p.uploaderName,
        uploaderRole: p.uploaderRole as AlbumPhoto['uploaderRole'],
        imageUrl: p.imageUrl,
        caption: p.caption,
        timestamp: p.timestampLabel,
        likesCount: p.likesCount,
        isLiked: p.isLiked,
        tags: Array.isArray(p.tags) ? p.tags : [],
      })),
      stories: storyRows.map((s) => ({
        id: s.id,
        userName: s.userName,
        userRole: s.userRole as StoryMoment['userRole'],
        mediaUrl: s.mediaUrl,
        text: s.text || undefined,
        createdAt: s.createdAtIso,
        expiresAt: s.expiresAtIso,
        viewed: s.viewed,
      })),
      guests: guestRows.map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone || undefined,
        status: g.status as Guest['status'],
        tableNumber: g.tableNumber || 1,
        dietary: g.dietary as Guest['dietary'],
        hasPlusOne: g.hasPlusOne,
        plusOneName: g.plusOneName || undefined,
        plusOneDietary: (g.plusOneDietary as Guest['dietary']) || undefined,
        attendingCeremony: g.attendingCeremony,
        attendingReception: g.attendingReception,
        notes: g.notes || undefined,
        updatedAt: g.updatedAt,
      })),
      expenses: expenseRows.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category as Expense['category'],
        vendorName: e.vendorName,
        estimatedCost: e.estimatedCost,
        actualCost: e.actualCost,
        paidAmount: e.paidAmount,
        dueDate: e.dueDate,
        isPaid: e.isPaid,
        notes: e.notes || undefined,
      })),
      totalBudget: Number(settingsMap.totalBudget || '75000'),
      vowsExcerpt: settingsMap.vowsExcerpt || INITIAL_WEDDING_DETAILS.couple.vowsExcerpt,
      studioCreations: creationRows,
    };
  } catch (error) {
    console.error('Database bootstrap query failed:', error);
    throw new Error('Failed to load wedding data from database.', { cause: error });
  }
}

export async function insertBatchPhotos(
  items: Array<{
    id: string;
    uploaderName: string;
    uploaderRole: string;
    uploaderUid?: string | null;
    imageUrl: string;
    caption: string;
    timestampLabel: string;
    tags: string[];
  }>
) {
  try {
    if (items.length === 0) return [];
    const inserted = await db
      .insert(photos)
      .values(
        items.map((item) => ({
          id: item.id,
          uploaderName: item.uploaderName,
          uploaderRole: item.uploaderRole,
          uploaderUid: item.uploaderUid || null,
          imageUrl: item.imageUrl,
          caption: item.caption,
          timestampLabel: item.timestampLabel || 'Just now',
          likesCount: 1,
          isLiked: true,
          tags: item.tags.length > 0 ? item.tags : ['Candid'],
        }))
      )
      .returning();

    return inserted.map((p) => ({
      id: p.id,
      uploaderName: p.uploaderName,
      uploaderRole: p.uploaderRole as AlbumPhoto['uploaderRole'],
      imageUrl: p.imageUrl,
      caption: p.caption,
      timestamp: p.timestampLabel,
      likesCount: p.likesCount,
      isLiked: p.isLiked,
      tags: Array.isArray(p.tags) ? p.tags : [],
    }));
  } catch (error) {
    console.error('Database insertBatchPhotos failed:', error);
    throw new Error('Failed to save uploaded photos.', { cause: error });
  }
}

export async function togglePhotoLike(photoId: string) {
  try {
    const existing = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (existing.length === 0) return null;
    const current = existing[0];
    const nextLiked = !current.isLiked;
    const nextLikes = nextLiked ? current.likesCount + 1 : Math.max(0, current.likesCount - 1);
    const updated = await db
      .update(photos)
      .set({ isLiked: nextLiked, likesCount: nextLikes })
      .where(eq(photos.id, photoId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database togglePhotoLike failed:', error);
    throw new Error('Failed to update photo like.', { cause: error });
  }
}

export async function insertStory(story: StoryMoment) {
  try {
    const [inserted] = await db
      .insert(stories)
      .values({
        id: story.id,
        userName: story.userName,
        userRole: story.userRole,
        mediaUrl: story.mediaUrl,
        text: story.text || null,
        createdAtIso: story.createdAt,
        expiresAtIso: story.expiresAt,
        viewed: story.viewed,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database insertStory failed:', error);
    throw new Error('Failed to save story.', { cause: error });
  }
}

export async function insertMilestone(m: StoryMilestone) {
  try {
    const [inserted] = await db
      .insert(milestones)
      .values({
        id: m.id,
        title: m.title,
        date: m.date,
        location: m.location,
        description: m.description,
        quote: m.quote || null,
        imageUrl: m.imageUrl,
        category: m.category,
        sortOrder: -1,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database insertMilestone failed:', error);
    throw new Error('Failed to save milestone.', { cause: error });
  }
}

export async function insertGuest(g: Guest) {
  try {
    const [inserted] = await db
      .insert(guests)
      .values({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone || null,
        status: g.status,
        tableNumber: g.tableNumber || 5,
        dietary: g.dietary,
        hasPlusOne: g.hasPlusOne,
        plusOneName: g.plusOneName || null,
        plusOneDietary: g.plusOneDietary || null,
        attendingCeremony: g.attendingCeremony,
        attendingReception: g.attendingReception,
        notes: g.notes || null,
        updatedAt: g.updatedAt,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database insertGuest failed:', error);
    throw new Error('Failed to add guest.', { cause: error });
  }
}

export async function updateGuestRecord(
  guestId: string,
  patch: Partial<{
    status: string;
    plusOneName: string;
    dietary: string;
    tableNumber: number;
    updatedAt: string;
  }>
) {
  try {
    const [updated] = await db
      .update(guests)
      .set(patch)
      .where(eq(guests.id, guestId))
      .returning();
    return updated || null;
  } catch (error) {
    console.error('Database updateGuestRecord failed:', error);
    throw new Error('Failed to update guest record.', { cause: error });
  }
}

export async function insertExpense(e: Expense) {
  try {
    const [inserted] = await db
      .insert(expenses)
      .values({
        id: e.id,
        title: e.title,
        category: e.category,
        vendorName: e.vendorName,
        estimatedCost: e.estimatedCost,
        actualCost: e.actualCost,
        paidAmount: e.paidAmount,
        dueDate: e.dueDate,
        isPaid: e.isPaid,
        notes: e.notes || null,
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database insertExpense failed:', error);
    throw new Error('Failed to add expense.', { cause: error });
  }
}

export async function toggleExpensePaidRecord(expenseId: string) {
  try {
    const rows = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);
    if (rows.length === 0) return null;
    const exp = rows[0];
    const isNowPaid = !exp.isPaid;
    const [updated] = await db
      .update(expenses)
      .set({
        isPaid: isNowPaid,
        paidAmount: isNowPaid ? exp.actualCost : 0,
      })
      .where(eq(expenses.id, expenseId))
      .returning();
    return updated || null;
  } catch (error) {
    console.error('Database toggleExpensePaidRecord failed:', error);
    throw new Error('Failed to update expense status.', { cause: error });
  }
}

export async function upsertAppSetting(key: string, value: string) {
  try {
    const [saved] = await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return saved;
  } catch (error) {
    console.error('Database upsertAppSetting failed:', error);
    throw new Error('Failed to update application setting.', { cause: error });
  }
}

export async function insertStudioCreation(entry: {
  id: string;
  kind: 'image' | 'music' | 'video' | 'transcript';
  title: string;
  prompt: string;
  mediaUrl?: string | null;
  lyricsOrText?: string | null;
  createdBy: string;
  userUid?: string | null;
}) {
  try {
    const [saved] = await db
      .insert(studioCreations)
      .values({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        prompt: entry.prompt,
        mediaUrl: entry.mediaUrl || null,
        lyricsOrText: entry.lyricsOrText || null,
        createdBy: entry.createdBy,
        userUid: entry.userUid || null,
      })
      .returning();
    return saved;
  } catch (error) {
    console.error('Database insertStudioCreation failed:', error);
    throw new Error('Failed to save studio creation.', { cause: error });
  }
}
