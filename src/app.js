// Bump VERSION/BUILD_DATE by hand on every release, alongside CHANGELOG.md
// (same convention as sos-net/sos-pcap/wgnettools/ifname etc: two-part
// version, build date as DDMMYYYY).
const VERSION = '1.9';
const BUILD_DATE = '23102026';

const input = document.getElementById('markdown-input');
const preview = document.getElementById('preview');

document.getElementById('version-badge').textContent = `v${VERSION} (${BUILD_DATE}) by manumaiden`;

// Dark mode: a pure UI preference (not the markdown draft itself), so
// remembering it in localStorage doesn't cross the "no draft persistence"
// line from the spec -- same reasoning as other per-viewer conveniences.
const THEME_STORAGE_KEY = 'md-preview-tool-theme';
const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = 'Light mode';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.textContent = 'Dark mode';
  }
}

let storedTheme = 'light';
try {
  storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
} catch (err) {
  storedTheme = 'light';
}
applyTheme(storedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch (err) {
    // localStorage unavailable (private browsing, etc.) -- the toggle
    // still works for this page view, it just won't be remembered.
  }
});

marked.setOptions({ breaks: true });

// Raw HTML in the markdown source is escaped rather than passed through:
// the rendered output is copied verbatim into the ticketing tool, so an
// event-handler attribute (e.g. from pasted customer text) must not survive
// into either this page or the pasted comment.
marked.use({
  renderer: {
    html(html) {
      const raw = typeof html === 'string' ? html : html.text;
      return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
  },
});

let debounceTimer = null;

function renderMarkdown() {
  preview.innerHTML = marked.parse(input.value);
}

const markdownStats = document.getElementById('markdown-stats');

function updateStats() {
  const text = input.value;
  const chars = text.length;
  const lines = text === '' ? 0 : text.split('\n').length;
  markdownStats.textContent = `${chars} character${chars === 1 ? '' : 's'}, ${lines} line${lines === 1 ? '' : 's'}`;
}

input.addEventListener('input', () => {
  updateStats();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderMarkdown, 150);
});

renderMarkdown();
updateStats();

const clearButton = document.getElementById('clear-button');

clearButton.addEventListener('click', () => {
  input.value = '';
  renderMarkdown();
  updateStats();
  input.focus();
});

const copyButton = document.getElementById('copy-button');
const copyStatus = document.getElementById('copy-status');

function showStatus(message, isError) {
  copyStatus.textContent = message;
  copyStatus.className = isError ? 'error' : 'success';
}

// Font applied to the copied rich text so it also survives paste into the
// ticketing tool, the same way bold/italic/headings already do: wrapping
// the copied HTML in an element with an inline style carries that style
// along with the clipboard payload.
const COPY_FONT_FAMILY = "'Courier New', Courier, monospace";
const COPY_FONT_SIZE = '13pt';

// Zero out the default top/bottom margin browsers put on block elements
// (paragraphs, lists, headings) so consecutive lines don't get an extra
// blank-line gap when pasted. Set inline (not via a stylesheet) so it
// travels with the copied HTML, same reasoning as the font above. This is
// a best-effort attempt: some ticketing tools re-normalize pasted HTML on
// save and may discard inline styles on the elements they create, in
// which case this has no effect there.
const COPY_ZERO_MARGIN_SELECTOR = 'p, ul, ol, li, h1, h2, h3, h4, h5, h6, blockquote, pre';

async function copyFormatted() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = preview.innerHTML;
  wrapper.querySelectorAll(COPY_ZERO_MARGIN_SELECTOR).forEach((el) => {
    el.style.margin = '0';
  });
  const html = `<div style="font-family: ${COPY_FONT_FAMILY}; font-size: ${COPY_FONT_SIZE};">${wrapper.innerHTML}</div>`;
  const text = preview.innerText;

  if (!navigator.clipboard || !window.ClipboardItem) {
    showStatus('Automatic copy not supported by this browser: select the text in the preview and copy with Ctrl+C.', true);
    return;
  }

  try {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    showStatus('Copied to clipboard.', false);
  } catch (err) {
    showStatus('Clipboard permission denied by the browser: select the text in the preview and copy with Ctrl+C.', true);
  }
}

copyButton.addEventListener('click', copyFormatted);

const copyPlainButton = document.getElementById('copy-plain-button');

async function copyPlain() {
  const text = preview.innerText;

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    showStatus('Automatic copy not supported by this browser: select the text in the preview and copy with Ctrl+C.', true);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied as plain text.', false);
  } catch (err) {
    showStatus('Clipboard permission denied by the browser: select the text in the preview and copy with Ctrl+C.', true);
  }
}

copyPlainButton.addEventListener('click', copyPlain);

// Snippet buttons (signature + templates): each reads its text from a file
// under snippets/, bind-mounted into the container so it can be edited on
// the host with any text editor and picked up on the next page reload,
// without rebuilding the container. See GUIDE.md.
const snippetCache = {};

async function loadSnippet(name) {
  try {
    const res = await fetch(`snippets/${name}.md`, { cache: 'no-store' });
    snippetCache[name] = res.ok ? await res.text() : '';
  } catch (err) {
    snippetCache[name] = '';
  }
}

function appendSnippet(text) {
  if (!text) return;
  const current = input.value;
  let separator = '\n\n';
  if (current.trim() === '') {
    separator = '';
  } else if (current.endsWith('\n\n')) {
    separator = '';
  } else if (current.endsWith('\n')) {
    separator = '\n';
  }
  input.value = current + separator + text;
  renderMarkdown();
  updateStats();
  input.focus();
  input.selectionStart = input.selectionEnd = input.value.length;
}

document.querySelectorAll('.snippet-button').forEach((button) => {
  const name = button.dataset.snippet;
  loadSnippet(name);
  button.addEventListener('click', () => appendSnippet(snippetCache[name]));
});

// "Back to top" button: lets you reach the snippet/Clear buttons again
// without scrolling up by hand after the page has grown taller than the
// viewport (e.g. a resized textarea or a long pasted log).
const scrollTopButton = document.getElementById('scroll-top-button');
const SCROLL_TOP_THRESHOLD = 300;

window.addEventListener('scroll', () => {
  scrollTopButton.classList.toggle('visible', window.scrollY > SCROLL_TOP_THRESHOLD);
});

scrollTopButton.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// "Insert Code Block" button: inserts a fenced code block with a dashed
// separator line above and below (common convention for pasted terminal
// output, see GUIDE.md), with the cursor left on the blank line in the
// middle, ready to paste into. Inserted at the current cursor position
// (not appended at the end, unlike the snippet buttons) so it can be
// dropped in the middle of a draft.
const codeBlockButton = document.getElementById('code-block-button');
const CODE_BLOCK_DASH_COUNT = 80;
const CODE_BLOCK_DASH_LINE = '-'.repeat(CODE_BLOCK_DASH_COUNT);
const CODE_BLOCK_PREFIX = '```bash\n' + CODE_BLOCK_DASH_LINE + '\n';
const CODE_BLOCK_TEMPLATE = CODE_BLOCK_PREFIX + '\n' + CODE_BLOCK_DASH_LINE + '\n```';

codeBlockButton.addEventListener('click', () => {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  // Start (and end) the block on its own line: a fenced code block mashed
  // into the middle of an existing line isn't valid markdown.
  const leadingNewline = before === '' || before.endsWith('\n') ? '' : '\n';
  const trailingNewline = after === '' || after.startsWith('\n') ? '' : '\n';
  const insertion = leadingNewline + CODE_BLOCK_TEMPLATE + trailingNewline;
  input.value = before + insertion + after;
  renderMarkdown();
  updateStats();
  input.focus();
  const cursorPos = start + leadingNewline.length + CODE_BLOCK_PREFIX.length;
  input.selectionStart = input.selectionEnd = cursorPos;
});

// Synced scroll: scrolling either the markdown textarea or the preview
// moves the other by the same proportion, so a long draft stays easy to
// compare side by side. Guarded with `isSyncingScroll` to avoid the two
// scroll listeners triggering each other in an infinite loop.
let isSyncingScroll = false;

function syncScroll(source, target) {
  if (isSyncingScroll) return;
  isSyncingScroll = true;
  const sourceRange = source.scrollHeight - source.clientHeight;
  if (sourceRange > 0) {
    const ratio = source.scrollTop / sourceRange;
    target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
  }
  isSyncingScroll = false;
}

input.addEventListener('scroll', () => syncScroll(input, preview));
preview.addEventListener('scroll', () => syncScroll(preview, input));
