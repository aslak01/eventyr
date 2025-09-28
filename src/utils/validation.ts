import { resolve, normalize } from "path";
import { getConfig } from "./config.ts";

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validatePath(path: string, basePath?: string): string {
  const config = getConfig();

  if (!path || typeof path !== "string") {
    throw new ValidationError("Path must be a non-empty string");
  }

  if (path.length > config.security.maxPathLength) {
    throw new ValidationError(
      `Path exceeds maximum length of ${config.security.maxPathLength}`,
    );
  }

  // Check for path traversal attempts
  if (path.includes("..") || path.includes("\0")) {
    throw new ValidationError(
      "Invalid path: contains path traversal sequences",
    );
  }

  // Normalize and resolve the path to prevent bypasses
  const normalizedPath = normalize(path);

  if (basePath) {
    const resolvedPath = resolve(basePath, normalizedPath);
    const resolvedBase = resolve(basePath);

    // Ensure the resolved path is within the base directory
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new ValidationError("Path escapes base directory");
    }

    return resolvedPath;
  }

  return normalizedPath;
}

export function validateFileExtension(filename: string): boolean {
  const config = getConfig();
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return config.security.allowedFileExtensions.includes(ext);
}

export function validateBookSlug(slug: string): void {
  if (!slug || typeof slug !== "string") {
    throw new ValidationError("Book slug must be a non-empty string");
  }

  // Allow alphanumeric, hyphens, and underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    throw new ValidationError("Book slug contains invalid characters");
  }

  if (slug.length > 100) {
    throw new ValidationError("Book slug exceeds maximum length");
  }
}

export function validatePdfFilename(filename: string): void {
  if (!filename || typeof filename !== "string") {
    throw new ValidationError("PDF filename must be a non-empty string");
  }

  if (!filename.endsWith(".pdf")) {
    throw new ValidationError("File must have .pdf extension");
  }

  // Check for dangerous characters
  if (/[<>:"|?*\0]/.test(filename)) {
    throw new ValidationError("Filename contains invalid characters");
  }

  if (filename.length > 255) {
    throw new ValidationError("Filename exceeds maximum length");
  }
}

export function isValidHttpMethod(
  method: string,
): method is "GET" | "POST" | "PUT" | "DELETE" | "PATCH" {
  return ["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method);
}
