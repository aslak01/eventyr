import type { createPathHelper } from "../utils/paths";

type PathHelper = ReturnType<typeof createPathHelper>;

const cssFileLink = (filename: string, pathHelper: PathHelper): string =>
  `<link rel="stylesheet" href="${pathHelper.asset(`/css/${filename}.css`)}">`;

const jsFileScript = (filename: string, pathHelper: PathHelper): string =>
  `<script src="${pathHelper.asset(`/js/${filename}.js`)}"></script>`;

export function htmlHead(
  title: string,
  pathHelper: PathHelper,
  cssFiles?: string[],
  jsFiles?: string[],
): { title: string; mainCssPath: string; additionalCss: string; additionalJs: string } {
  const allCssFiles = ["header-footer", ...(cssFiles || [])];
  const additionalCss = allCssFiles
    .map((file) => cssFileLink(file, pathHelper))
    .join("");

  const additionalJs = jsFiles
    ? jsFiles.map((file) => jsFileScript(file, pathHelper)).join("")
    : "";

  return {
    title,
    mainCssPath: pathHelper.asset("/css/main.css"),
    additionalCss,
    additionalJs,
  };
}
