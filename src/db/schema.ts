import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Wedding Guest'),
  role: text('role').notNull().default('Guest'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const milestones = pgTable('milestones', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  date: text('date').notNull(),
  location: text('location').notNull(),
  description: text('description').notNull(),
  quote: text('quote'),
  imageUrl: text('image_url').notNull(),
  category: text('category').notNull().default('Adventure'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const photos = pgTable('photos', {
  id: text('id').primaryKey(),
  uploaderName: text('uploader_name').notNull(),
  uploaderRole: text('uploader_role').notNull().default('Guest'),
  uploaderUid: text('uploader_uid'),
  imageUrl: text('image_url').notNull(),
  caption: text('caption').notNull(),
  timestampLabel: text('timestamp_label').notNull().default('Just now'),
  likesCount: integer('likes_count').notNull().default(0),
  isLiked: boolean('is_liked').notNull().default(false),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stories = pgTable('stories', {
  id: text('id').primaryKey(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull().default('Guest'),
  mediaUrl: text('media_url').notNull(),
  text: text('text'),
  createdAtIso: text('created_at_iso').notNull(),
  expiresAtIso: text('expires_at_iso').notNull(),
  viewed: boolean('viewed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const guests = pgTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status').notNull().default('Pending'),
  tableNumber: integer('table_number').default(1),
  dietary: text('dietary').notNull().default('None'),
  hasPlusOne: boolean('has_plus_one').notNull().default(false),
  plusOneName: text('plus_one_name'),
  plusOneDietary: text('plus_one_dietary'),
  attendingCeremony: boolean('attending_ceremony').notNull().default(false),
  attendingReception: boolean('attending_reception').notNull().default(false),
  notes: text('notes'),
  updatedAt: text('updated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  vendorName: text('vendor_name').notNull(),
  estimatedCost: integer('estimated_cost').notNull().default(0),
  actualCost: integer('actual_cost').notNull().default(0),
  paidAmount: integer('paid_amount').notNull().default(0),
  dueDate: text('due_date').notNull(),
  isPaid: boolean('is_paid').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const studioCreations = pgTable('studio_creations', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // 'image' | 'music' | 'video' | 'transcript'
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  mediaUrl: text('media_url'),
  lyricsOrText: text('lyrics_or_text'),
  createdBy: text('created_by').notNull().default('Couple'),
  userUid: text('user_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  uploadedPhotos: many(photos),
  creations: many(studioCreations),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  author: one(users, {
    fields: [photos.uploaderUid],
    references: [users.uid],
  }),
}));

export const studioCreationsRelations = relations(studioCreations, ({ one }) => ({
  author: one(users, {
    fields: [studioCreations.userUid],
    references: [users.uid],
  }),
}));
