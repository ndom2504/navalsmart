import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectAvatar } from "@/domain/types";
import { getProject, ServiceError, setProjectAvatar } from "@/server/estimates";

export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<ProjectAvatar["mimeType"], string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Type réel de l'image d'après ses premiers octets : l'extension et le type annoncé ne suffisent pas. */
function imageType(buffer: Buffer): ProjectAvatar["mimeType"] | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const uploadsRoot = () => path.join(process.cwd(), "uploads");

function insideUploads(storedPath: string): string | null {
  const resolved = path.resolve(storedPath);
  const relative = path.relative(uploadsRoot(), resolved);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? resolved : null;
}

async function removeFile(avatar: ProjectAvatar | null) {
  const file = avatar ? insideUploads(avatar.storedPath) : null;
  if (file) await fs.rm(file, { force: true });
}

export async function saveProjectAvatar(projectId: string, buffer: Buffer): Promise<void> {
  if (buffer.length === 0 || buffer.length > AVATAR_MAX_BYTES) throw new ServiceError("L'image doit peser au plus 10 Mo.");
  const mimeType = imageType(buffer);
  if (!mimeType) throw new ServiceError("Format accepté : PNG, JPEG ou WebP.");
  const project = await getProject(projectId);
  const directory = path.join(uploadsRoot(), project.id);
  await fs.mkdir(directory, { recursive: true });
  const storedPath = path.join(directory, `avatar-${crypto.randomUUID()}.${EXTENSIONS[mimeType]}`);
  await fs.writeFile(storedPath, buffer);
  const previous = await setProjectAvatar(project.id, { storedPath, mimeType, updatedAt: new Date().toISOString() }).catch(async (error) => {
    await fs.rm(storedPath, { force: true });
    throw error;
  });
  await removeFile(previous);
}

export async function deleteProjectAvatar(projectId: string): Promise<void> {
  await removeFile(await setProjectAvatar(projectId, null));
}

export async function readProjectAvatar(projectId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const project = await getProject(projectId);
  const file = project.avatar ? insideUploads(project.avatar.storedPath) : null;
  if (!project.avatar || !file) return null;
  const buffer = await fs.readFile(file).catch(() => null);
  return buffer ? { buffer, mimeType: project.avatar.mimeType } : null;
}
