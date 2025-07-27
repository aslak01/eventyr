import type { createPathHelper } from "../utils/paths";

type PathHelper = ReturnType<typeof createPathHelper>;

const cssFileLink = (filename: string, pathHelper: PathHelper): string =>
  `<link rel="stylesheet" href="${pathHelper.asset(`/css/${filename}.css`)}">`;

export function htmlHead(
  title: string,
  pathHelper: PathHelper,
  cssFiles?: string[],
): { title: string; mainCssPath: string; additionalCss: string } {
  const additionalCss = cssFiles
    ? cssFiles.map((file) => cssFileLink(file, pathHelper)).join("")
    : "";

  return {
    title,
    mainCssPath: pathHelper.asset("/css/main.css"),
    additionalCss,
  };
}
