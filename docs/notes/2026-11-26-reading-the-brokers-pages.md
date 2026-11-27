<!-- Research note, not a decision. Measured 26 November 2026 on one developer machine, Node 26. -->

# Reading the Broker's pages: the regexes already misread them

**Verdict.** The regexes `tests/brokered-app.ts` used to carry misread real Broker pages. They
agreed with every DOM parser measured on forms and links, and got the readable text wrong on 64 of
370 pages: 29 kept an entity undecoded (`&#42;`), and 35 leaked a script body, because Keycloak
serves one `<SCRIPT>` in upper case and the strip was case-sensitive. happy-dom and parse5 read
every page as the regexes did apart from those two faults, and pass every adversarial snippet.
`tests/brokered-app.ts` now uses happy-dom, because it reads through the standard DOM API, at a
cost of 2 to 3 seconds on the suite. parse5 is the fallback if that time or its 22 MB install
matters.

**Read on only if** you are reconsidering happy-dom for the harness, or are about to pick another
HTML parser.

## How it was measured

The suite ran once on `main` at `6b5af91` with a hook in `formsOn`, `anchorsIn` and
`readableTextOf` that saved every page they were handed: 370 distinct pages. Each candidate then
re-implemented the three readers behind the same interface. Its output was compared with the
regexes' on every page, and on nine adversarial snippets: single-quoted, unquoted and upper-case
markup, a `>` inside an attribute, numeric and named entities, an unclosed form, `</form>` inside a
script, a form inside a comment, and a boolean attribute before `name`. The hook and the scratch
code were not committed.

| | Pages differing from the regexes | Adversarial | Install | Packages | ms per page | Cold import |
|---|---|---|---|---|---|---|
| regexes | — | 2/9 | 0 | 0 | 0.04 | — |
| happy-dom 21.0.4 | text 64, the two faults | 9/9 | 22 MB | 8 | 2.6 | 76 ms |
| parse5 8.1.1 | text 64, the two faults | 9/9 | 0.9 MB | 1 | 0.6 | 7 ms |
| cheerio 1.2.0 | text 64, the two faults | 9/9 | 9 MB | 22 | 0.9 | 54 ms |
| linkedom 0.18.15 | text 64, the two faults | 8/9 | 8 MB | 19 | 0.8 | 39 ms |
| node-html-parser 9.0.7 | text 369 | 8/9 | 3 MB | 10 | 0.26 | 3 ms |

"ms per page" is forms, links and text read off one page, which is three parses. jsdom 31.0.1 was
sized and not measured: 22 MB and 27 packages buy nothing happy-dom does not. No newer parser
turned up. Every licence in these trees is MIT, ISC, BSD or Apache-2.0.

Once adopted, happy-dom cost the suite about 2 to 3 seconds, on a run of about 13 seconds: two runs
took 15.2 s and 16.3 s, against 12.9 s on `main`, each on a freshly reset Broker. Vitest's import
share doubled, because every test file that reads a page imports happy-dom afresh. That is about
twice what the per-page figures above predict.

## Dead ends

- **cheerio's `.attr("value")`** answers with jQuery's idea of the value: `"on"` for a checkbox
  that carries none. It differed on 26 forms until the attribute was read from `attribs` instead.
- **linkedom** misses `<FORM>` and `<INPUT>` written in upper case. Keycloak writes `<SCRIPT>` that
  way already.
- **node-html-parser** reads `<!DOCTYPE html>` as text and leaves an unclosed form empty.
- **A happy-dom `Window` per page** ran a 4 GB heap out of memory within about 3,000 parses. One
  `Window` with JavaScript evaluation off and one `DOMParser` for the whole run is what was timed.
- **Joining every text node with a space** splits words around an entity, `Haven ' t`, in a parser
  that keeps entities as separate nodes. A space belongs where a tag was.

## What this reading does not fix

- **`pageComplaint` reads by element id** (`kc-page-title`, `input-error*`). It only explains a
  failure and decides nothing, and its last line already says everything the page says.
