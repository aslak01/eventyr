const cssFileLink = (filename: string): string =>
  `<link rel="stylesheet" href="/css/${filename}.css">`;

const jsFileScript = (filename: string): string =>
  `<script src="/js/${filename}.js"></script>`;

export function htmlHead(
  title: string,
  cssFiles?: string[],
  jsFiles?: string[],
): {
  title: string;
  mainCssPath: string;
  additionalCss: string;
  additionalJs: string;
} {
  const allCssFiles = [...(cssFiles || [])];
  const additionalCss = allCssFiles.map((file) => cssFileLink(file)).join("");

  const additionalJs = jsFiles
    ? jsFiles.map((file) => jsFileScript(file)).join("")
    : "";

  return {
    title,
    mainCssPath: "/css/main.css",
    additionalCss,
    additionalJs,
  };
}
