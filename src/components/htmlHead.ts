const cssFileLink = (filename: string): string =>
  `<link rel="stylesheet" href="/css/${filename}.css">`;

export function htmlHead(title: string, cssFiles?: string[]): string {
  return `<!DOCTYPE html>
<html lang="nb-NO">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="/css/main.css">
    ${cssFiles ? cssFiles.map(cssFileLink) : ""}
</head>
<body>
`;
}
