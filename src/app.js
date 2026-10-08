// Bump VERSION/BUILD_DATE by hand on every release, alongside CHANGELOG.md
// (same convention as sos-net/sos-pcap/wgnettools/ifname etc: two-part
// version, build date as DDMMYYYY).
const VERSION = '1.4';
const BUILD_DATE = '08102026';

const input = document.getElementById('markdown-input');
const preview = document.getElementById('preview');

document.getElementById('version-badge').textContent = `v${VERSION} (${BUILD_DATE}) by manumaiden`;

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

input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderMarkdown, 150);
});

renderMarkdown();

const clearButton = document.getElementById('clear-button');

clearButton.addEventListener('click', () => {
  input.value = '';
  renderMarkdown();
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
  input.focus();
  input.selectionStart = input.selectionEnd = input.value.length;
}

document.querySelectorAll('.snippet-button').forEach((button) => {
  const name = button.dataset.snippet;
  loadSnippet(name);
  button.addEventListener('click', () => appendSnippet(snippetCache[name]));
});
