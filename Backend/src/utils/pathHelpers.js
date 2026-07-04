import { fileURLToPath } from "url";
import { dirname, join } from "path";

export const getDirname = (metaUrl) => dirname(fileURLToPath(metaUrl));

export const getProjectRoot = () => {
  const currentDir = getDirname(import.meta.url);
  return join(currentDir, "..", "..");
};
