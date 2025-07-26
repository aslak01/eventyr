import type { createPathHelper } from "../utils/paths";

type PathHelper = ReturnType<typeof createPathHelper>;

const cssFileLink = (filename: string, pathHelper: PathHelper): string =>
  `<link rel="stylesheet" href="${pathHelper.asset(`/css/${filename}.css`)}">`;

export function htmlHead(title: string, pathHelper: PathHelper, cssFiles?: string[]): string {
  return `<!DOCTYPE html>
<html lang="nb-NO">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="${pathHelper.asset('/css/main.css')}">
    ${cssFiles ? cssFiles.map(file => cssFileLink(file, pathHelper)).join('') : ""}
</head>
<body>
`;
}
