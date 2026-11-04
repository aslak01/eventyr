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
  let normalizedPath = normalize(path);

  // Remove leading slash for relative resolution when using basePath
  if (basePath && normalizedPath.startsWith("/")) {
    normalizedPath = normalizedPath.slice(1);
  }

  if (basePath) {
    const resolvedPath = resolve(basePath, normalizedPath);
    const resolvedBase = resolve(basePath);

    // Ensure the resolved path is within the base directory
    // The resolved path should either be exactly the base path or start with base path + separator
    if (
      resolvedPath !== resolvedBase &&
      !resolvedPath.startsWith(resolvedBase + "/")
    ) {
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
