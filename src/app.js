const input = document.getElementById('markdown-input');
const preview = document.getElementById('preview');

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

const copyButton = document.getElementById('copy-button');
const copyStatus = document.getElementById('copy-status');

function showStatus(message, isError) {
  copyStatus.textContent = message;
  copyStatus.className = isError ? 'error' : 'success';
}

async function copyFormatted() {
  const html = preview.innerHTML;
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
