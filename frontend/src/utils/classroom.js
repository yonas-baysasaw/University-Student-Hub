import { readJsonOrThrow } from "./http";

export function isInstructor(user) {
  const role = `${user?.role ?? ""}`.toLowerCase();
  return (
    role === "instructor" ||
    role === "teacher" ||
    role === "lecturer" ||
    role === "admin"
  );
}

export function getMemberName(member) {
  if (!member) return "Participant";
  if (member.username) return member.username;
  if (member.displayName) return member.displayName;
  if (member.email) return member.email.split("@")[0] || member.email;
  return "Participant";
}

/**
 * @param {{ creator?: unknown } | null | undefined} chat
 * @returns {string | undefined}
 */
export function getCreatorId(chat) {
  if (!chat?.creator) return undefined;
  return String(chat.creator._id ?? chat.creator);
}

/**
 * @param {{ creator?: unknown } | null | undefined} chat
 * @param {unknown} userId
 */
export function isUserClassOwner(chat, userId) {
  const uid =
    userId != null && userId !== "" ? String(userId) : "";
  const cid = getCreatorId(chat);
  return !!(uid && cid && uid === cid);
}

/**
 * In `admins` but not the classroom creator (for "Admin" badge).
 * @param {{ creator?: unknown, admins?: unknown[] } | null | undefined} chat
 * @param {unknown} userId
 */
export function isUserClassAdmin(chat, userId) {
  if (!userId || isUserClassOwner(chat, userId)) return false;
  const uid = String(userId);
  const admins = Array.isArray(chat?.admins) ? chat.admins : [];
  return admins.some((a) => String(a?._id ?? a) === uid);
}

/**
 * @param {{ _id?: string, id?: string } | null} user
 * @param {{ creator?: unknown } | null | undefined} chat
 */
export function isClassroomCreator(user, chat) {
  const uid = user?._id ?? user?.id;
  if (!uid || !chat) return false;
  return isUserClassOwner(chat, uid);
}

/**
 * Creator or listed admins can manage classroom schedule / announcements.
 * @param {{ id?: string } | null} user
 * @param {{ creator?: unknown, admins?: unknown[] } | null | undefined} chat
 */
export function canManageClassroom(user, chat) {
  const uid = String(user?._id ?? user?.id ?? '');
  if (!uid || !chat) return false;
  const creatorId = chat.creator?._id ?? chat.creator;
  if (creatorId != null && String(creatorId) === uid) return true;
  const admins = Array.isArray(chat.admins) ? chat.admins : [];
  return admins.some((a) => String(a?._id ?? a) === uid);
}

/**
 * Creator or listed members (for classroom-level UI such as read-only schedule).
 * @param {{ id?: string } | null} user
 * @param {{ creator?: unknown, members?: unknown[] } | null | undefined} chat
 */
export function isClassroomMember(user, chat) {
  const uid = String(user?._id ?? user?.id ?? '');
  if (!uid || !chat) return false;
  const creatorId = chat.creator?._id ?? chat.creator;
  if (creatorId != null && String(creatorId) === uid) return true;
  const members = Array.isArray(chat.members) ? chat.members : [];
  return members.some((m) => String(m?._id ?? m) === uid);
}

export async function fetchClassroomMeta(chatId, signal) {
  const response = await fetch("/api/chats?limit=100", {
    credentials: "include",
    signal,
  });
  const payload = await readJsonOrThrow(
    response,
    "Unable to load classroom details",
  );
  const chat = (payload?.chats ?? []).find(
    (item) => String(item._id) === String(chatId),
  );
  if (!chat) {
    throw new Error("Classroom not found");
  }
  return chat;
}
