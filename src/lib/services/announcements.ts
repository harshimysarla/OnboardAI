import { connectDB } from "@/lib/db";
import { Announcement, Notification, User } from "@/lib/models";
import { serializeDoc } from "@/lib/serialize";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "@/lib/services/auth";

type AnnounceUser = Pick<AuthenticatedUser, "id" | "company_id" | "role" | "full_name">;

function uidSet(arr: Types.ObjectId[] | undefined): Set<string> {
  return new Set((arr || []).map((v) => v.toString()));
}

export async function listAnnouncements(user: AnnounceUser) {
  const conn = await connectDB();
  if (!conn) return null;

  const docs = await Announcement.find({ company_id: user.company_id })
    .sort({ pinned: -1, published_at: -1 })
    .lean();

  const rows = docs.map((a) => {
    const me = user.id;
    const likes = (a.likes as Types.ObjectId[]) || [];
    const bookmarks = (a.bookmarks as Types.ObjectId[]) || [];
    const comments = (a.comments as { _id: Types.ObjectId; user_id?: Types.ObjectId; full_name: string; content: string; created_at: Date }[]) || [];
    return {
      ...serializeDoc(a as unknown as Record<string, unknown>),
      like_count: likes.length,
      liked_by_me: uidSet(likes).has(me),
      bookmark_count: bookmarks.length,
      bookmarked_by_me: uidSet(bookmarks).has(me),
      comment_count: comments.length,
      comments: comments
        .sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime())
        .map((c) => ({
          id: c._id ? c._id.toString() : "",
          user_id: c.user_id?.toString() || "",
          full_name: c.full_name,
          content: c.content,
          created_at: c.created_at,
        })),
    };
  });

  return { announcements: rows };
}

export async function createAnnouncement(
  user: AnnounceUser,
  input: { title: string; content: string; category: string; pinned?: boolean }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");
  if (user.role !== "admin" && user.role !== "hr") {
    throw new Error("Insufficient permissions");
  }

  const doc = await Announcement.create({
    company_id: user.company_id,
    author_id: user.id,
    author_name: user.full_name,
    title: input.title,
    content: input.content,
    category: input.category,
    pinned: !!input.pinned,
    published_at: new Date(),
  });

  // Notify all company users (except the author)
  const recipients = await User.find({
    company_id: user.company_id,
    _id: { $ne: user.id },
  })
    .select("_id")
    .lean();
  if (recipients.length) {
    await Notification.insertMany(
      recipients.map((u) => ({
        company_id: user.company_id,
        user_id: u._id,
        title: "New announcement",
        body: `${user.full_name} posted: ${input.title}`,
      }))
    ).catch((e) => console.error("Notification insert failed:", e));
  }

  return serializeDoc(doc.toObject());
}

export async function updateAnnouncement(
  user: AnnounceUser,
  input: { id: string; title?: string; content?: string; pinned?: boolean }
) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const doc = await Announcement.findOne({ _id: input.id, company_id: user.company_id });
  if (!doc) return { error: "Announcement not found" };

  const isStaff = user.role === "admin" || user.role === "hr";
  const isAuthor = doc.author_id?.toString() === user.id;
  if (!isStaff && !isAuthor) return { error: "You cannot edit this announcement" };

  if (input.title !== undefined) doc.title = input.title;
  if (input.content !== undefined) doc.content = input.content;
  if (input.pinned !== undefined) doc.pinned = input.pinned;
  await doc.save();
  return serializeDoc(doc.toObject());
}

export async function deleteAnnouncement(user: AnnounceUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const doc = await Announcement.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Announcement not found" };

  const isStaff = user.role === "admin" || user.role === "hr";
  const isAuthor = doc.author_id?.toString() === user.id;
  if (!isStaff && !isAuthor) return { error: "You cannot delete this announcement" };

  await Announcement.deleteOne({ _id: doc._id });
  return { ok: true };
}

export async function toggleLike(user: AnnounceUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const doc = await Announcement.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Announcement not found" };

  const me = new Types.ObjectId(user.id);
  const likes = uidSet(doc.likes as Types.ObjectId[]);
  if (likes.has(user.id)) {
    doc.likes = ((doc.likes as Types.ObjectId[]) || []).filter((v) => v.toString() !== user.id);
  } else {
    doc.likes = [...((doc.likes as Types.ObjectId[]) || []), me];
  }
  await doc.save();
  return serializeDoc(doc.toObject());
}

export async function toggleBookmark(user: AnnounceUser, id: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const doc = await Announcement.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Announcement not found" };

  const me = new Types.ObjectId(user.id);
  const bookmarks = uidSet(doc.bookmarks as Types.ObjectId[]);
  if (bookmarks.has(user.id)) {
    doc.bookmarks = ((doc.bookmarks as Types.ObjectId[]) || []).filter((v) => v.toString() !== user.id);
  } else {
    doc.bookmarks = [...((doc.bookmarks as Types.ObjectId[]) || []), me];
  }
  await doc.save();
  return serializeDoc(doc.toObject());
}

export async function addComment(user: AnnounceUser, id: string, content: string) {
  const conn = await connectDB();
  if (!conn) throw new Error("Database not configured");

  const doc = await Announcement.findOne({ _id: id, company_id: user.company_id });
  if (!doc) return { error: "Announcement not found" };

  doc.comments = [
    ...((doc.comments as unknown[]) || []),
    { user_id: user.id, full_name: user.full_name, content, created_at: new Date() },
  ];
  await doc.save();
  return serializeDoc(doc.toObject());
}

export async function getNotifications(user: AnnounceUser) {
  const conn = await connectDB();
  if (!conn) return { notifications: [], unread: 0 };

  const docs = await Notification.find({ company_id: user.company_id, user_id: user.id })
    .sort({ created_at: -1 })
    .limit(50)
    .lean();
  const unread = await Notification.countDocuments({
    company_id: user.company_id,
    user_id: user.id,
    read: false,
  });
  return {
    notifications: docs.map((n) => serializeDoc(n as unknown as Record<string, unknown>)),
    unread,
  };
}

export async function markNotificationsRead(user: AnnounceUser) {
  const conn = await connectDB();
  if (!conn) return null;
  await Notification.updateMany(
    { company_id: user.company_id, user_id: user.id, read: false },
    { $set: { read: true } }
  );
  return { ok: true };
}