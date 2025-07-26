import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { joinAuthors, safeString } from "../utils/strings";

type PathHelper = ReturnType<typeof createPathHelper>;

export function headerGenerator(book: BookData, pathHelper: PathHelper) {
  return `
    <div class="header">
<div>
        <a class="book-name" href="${pathHelper.page('/')}">Eventyrsamling</a>
</div>
<div>
        <a class="book-name" href="${pathHelper.page(`/${book.slug}/`)}">${safeString(book.name)}</a>
</div>
<div>
${joinAuthors(book.author)} -
${book.published}
    </div>
`;
}
