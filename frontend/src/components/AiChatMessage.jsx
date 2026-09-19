const BOLD_PATTERN = /\*\*(.+?)\*\*/g;
const NUMBERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*]\s+(.*)$/;

/**
 * Splits one line of text on `**bold**` runs and returns an array of plain
 * strings and <strong> elements — every piece is still just a React child,
 * never HTML, so there is no way for stray "<"/">" characters in the text
 * (from the model or a user) to be interpreted as a tag.
 */
function renderInline(line, keyPrefix) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    parts.push(<strong key={`${keyPrefix}-b${i}`}>{match[1]}</strong>);
    lastIndex = BOLD_PATTERN.lastIndex;
    i += 1;
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts;
}

/**
 * A tiny, deliberately narrow Markdown-lite renderer: bold text, numbered
 * lists, bullet lists, and line breaks — exactly what the AI assistant's
 * replies actually use. It builds real React elements from parsed tokens
 * (never dangerouslySetInnerHTML, never an HTML string), so plain text with
 * no Markdown in it renders exactly as it always has, and any literal HTML
 * a message happens to contain is just inert text, never markup.
 */
function renderMarkdownLite(text) {
  const lines = String(text).split('\n');
  const blocks = [];
  let currentList = null;
  let currentParagraph = null;

  const flushParagraph = () => {
    if (currentParagraph) blocks.push({ type: 'p', lines: currentParagraph });
    currentParagraph = null;
  };
  const flushList = () => {
    if (currentList) blocks.push(currentList);
    currentList = null;
  };

  for (const rawLine of lines) {
    const numbered = rawLine.match(NUMBERED_ITEM);
    const bulleted = !numbered && rawLine.match(BULLET_ITEM);

    if (numbered) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numbered[1]);
    } else if (bulleted) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulleted[1]);
    } else if (rawLine.trim() === '') {
      flushList();
      flushParagraph();
    } else {
      flushList();
      if (!currentParagraph) currentParagraph = [];
      currentParagraph.push(rawLine);
    }
  }
  flushList();
  flushParagraph();

  return blocks.map((block, blockIndex) => {
    const spacing = blockIndex > 0 ? 'mt-2' : '';

    if (block.type === 'ol' || block.type === 'ul') {
      const ListTag = block.type;
      return (
        <ListTag key={blockIndex} className={`${spacing} ml-5 space-y-0.5 ${block.type === 'ol' ? 'list-decimal' : 'list-disc'}`}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, `${blockIndex}-${i}`)}</li>
          ))}
        </ListTag>
      );
    }

    return (
      <p key={blockIndex} className={spacing}>
        {block.lines.map((line, i) => (
          <span key={i}>
            {renderInline(line, `${blockIndex}-${i}`)}
            {i < block.lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

/**
 * `text` is always rendered through renderMarkdownLite() into real React
 * elements, never via dangerouslySetInnerHTML — so backend/user content can
 * never be interpreted as HTML, only as the narrow bold/list/line-break
 * subset this component understands.
 *
 * `reportId` only ever comes from the backend's own structured chat
 * response (see AiAssistantPage.jsx's getValidReport) — it is re-validated
 * here too before the download button is shown, since this component makes
 * no assumption about what a caller passes in.
 */
export function AiChatMessage({ role, text, reportId, downloading, onDownload }) {
  const isUser = role === 'user';
  const hasValidReport = typeof reportId === 'string' && reportId.trim().length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? 'bg-blue-700 text-white' : 'border border-neutral-200 bg-white text-neutral-900'
        }`}
      >
        <div className="break-words">{renderMarkdownLite(text)}</div>

        {hasValidReport && (
          <button
            onClick={onDownload}
            disabled={downloading}
            className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-60"
          >
            {downloading ? 'Preparing…' : 'Download Report'}
          </button>
        )}
      </div>
    </div>
  );
}
