#!/usr/bin/env python3
"""Golden test for copyFormatted()/copyPlain() output.

Loads the real src/index.html in headless Chrome (Playwright), feeds each
markdown fixture in fixtures/ into the textarea, calls the actual
copyFormatted()/copyPlain() functions from app.js, reads back what they
wrote to the clipboard, and compares it byte-for-byte against a saved
reference. This exercises the production code path end to end (marked.js
rendering, the HTML-escaping renderer, the copy wrapper, the real
clipboard write) -- nothing here is a re-implementation of app.js.

Run normally to check for regressions:
    python3 tests/test_golden.py

Regenerate references after a deliberate, reviewed output change:
    python3 tests/test_golden.py --update

Requires: the "playwright" Python package and a local Google Chrome
install (channel="chrome" -- no browser binary is downloaded, the test
drives the system install directly). Not part of the shipped app; this
runs only on a developer machine, never inside the Docker image.
"""
import argparse
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "src" / "index.html"
FIXTURES_DIR = pathlib.Path(__file__).resolve().parent / "fixtures"


def capture(page, markdown):
    page.fill("#markdown-input", markdown)
    page.evaluate("window.copyFormatted()")
    page.wait_for_timeout(200)
    formatted_html = page.evaluate(
        """
        async () => {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes('text/html')) {
              return await (await item.getType('text/html')).text();
            }
          }
          return null;
        }
        """
    )
    page.evaluate("window.copyPlain()")
    page.wait_for_timeout(200)
    plain_text = page.evaluate("navigator.clipboard.readText()")
    return formatted_html.encode("utf-8"), plain_text.encode("utf-8")


def first_diff(a, b):
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i
    return min(len(a), len(b))


def run(update):
    md_files = sorted(FIXTURES_DIR.glob("*.md"))
    if not md_files:
        print("No fixtures found in", FIXTURES_DIR)
        return 1

    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context()
        context.grant_permissions(["clipboard-read", "clipboard-write"])
        page = context.new_page()

        for md_path in md_files:
            page.goto(f"file://{INDEX}")
            page.wait_for_load_state("networkidle")
            markdown = md_path.read_text(encoding="utf-8")
            formatted, plain = capture(page, markdown)

            html_ref = md_path.with_suffix(".copyformatted.html")
            plain_ref = md_path.with_suffix(".copyplain.txt")

            if update:
                html_ref.write_bytes(formatted)
                plain_ref.write_bytes(plain)
                print(f"[updated] {md_path.name}")
                continue

            if not html_ref.exists() or not plain_ref.exists():
                failures.append((md_path.name, "missing reference file(s) -- run with --update first"))
                continue

            expected_html = html_ref.read_bytes()
            expected_plain = plain_ref.read_bytes()

            ok = True
            if formatted != expected_html:
                ok = False
                idx = first_diff(formatted, expected_html)
                failures.append((
                    md_path.name,
                    "copyFormatted() HTML differs at byte %d:\n    got      ...%r...\n    expected ...%r..."
                    % (idx, formatted[max(0, idx - 20):idx + 20], expected_html[max(0, idx - 20):idx + 20]),
                ))
            if plain != expected_plain:
                ok = False
                idx = first_diff(plain, expected_plain)
                failures.append((
                    md_path.name,
                    "copyPlain() text differs at byte %d:\n    got      ...%r...\n    expected ...%r..."
                    % (idx, plain[max(0, idx - 20):idx + 20], expected_plain[max(0, idx - 20):idx + 20]),
                ))
            print(f"[{'ok' if ok else 'FAIL'}] {md_path.name}")

        browser.close()

    if update:
        print(f"\nWrote reference files for {len(md_files)} fixture(s).")
        return 0

    if failures:
        print(f"\n{len(failures)} failure(s):")
        for name, msg in failures:
            print(f" - {name}: {msg}")
        return 1

    print(f"\nAll {len(md_files)} fixture(s) match the saved reference, byte-for-byte.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true", help="(re)generate reference files instead of checking them")
    args = parser.parse_args()
    sys.exit(run(args.update))
