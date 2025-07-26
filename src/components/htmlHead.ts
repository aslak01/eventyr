import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

const cssFileLink = (filename: string, pathHelper: PathHelper): string =>
  `<link rel="stylesheet" href="${pathHelper.asset(`/css/${filename}.css`)}">`;

export function htmlHead(
  title: string,
  pathHelper: PathHelper,
  cssFiles?: string[],
): string {
  const additionalCss = cssFiles
    ? cssFiles.map((file) => cssFileLink(file, pathHelper)).join("")
    : "";

  return templateEngine.render("html-head.html", {
    title,
    mainCssPath: pathHelper.asset("/css/main.css"),
    additionalCss,
  });
}
