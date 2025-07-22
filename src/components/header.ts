import type { BookData } from "../types/types";
import { joinAuthors, safeString } from "../utils/strings";

export function headerGenerator(book: BookData) {
  return `
    <div class="header">
<div>
        <a class="book-name" href="/">Eventyrsamling</a>
</div>
<div>
        <a class="book-name" href="/${book.slug}/">${safeString(book.name)}</a>
</div>
<div>
${joinAuthors(book.author)} -
${book.published}
    </div>
`;
}
