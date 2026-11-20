#!/usr/bin/env bash
# Prose we add goes once. See docs/agents/external-repos.md, "Vocabulary: the
# application's words, never ours" -- our context "goes **once**, in prose, in
# LOCAL-DEV.md or in the pull request body ... never repeated comment by
# comment" -- and CODING_STANDARDS.md, which says the same of this repository:
# a rule written in two places will disagree with itself.
#
# This is a reminder, not a gate, for the two reasons its sibling
# check-foreign-vocabulary.sh gives and one of its own: it cannot run as a git
# hook in somebody else's repository, it needs a fixed point so it cannot join
# `pnpm check`, and what it prints is a judgement rather than a verdict. The
# checklist calls it by hand before a pull request is opened. It reads added
# lines -- what we wrote -- and leaves the application's own text alone.
#
# Run it from inside the repository whose branch is being read:
#
#   .../citsci-federation/scripts/check-repeated-prose.sh          # the branch's diff
#   .../check-repeated-prose.sh --base origin/main                 # against another base
#   .../check-repeated-prose.sh pr-body.md                         # the body, with the diff
#   gh pr view 1 --json body -q .body | .../check-repeated-prose.sh -
#
# Files named on the command line are read whole and added to the branch's
# added lines, because the rule puts the pull request body in the same unit as
# the diff: a paragraph in both is a paragraph written twice.
#
# The diff alone is the strict reading, and the one to start with. A body
# restates the change by design, so adding it turns up real copies -- a
# docstring quoted into the body -- beside pairs that are the body doing its
# job. Add it when the body is what you are checking.
#
# Exit 0 when it finds nothing, 1 when it finds something. A pair is not a
# defect by itself -- a sentence quoted on purpose, a phrase the domain has
# only one wording for, two comments that happen to share a clause. What is
# checked is that somebody read it.
#
# It finds near-literal repetition and nothing else. Paraphrase is out of
# scope: no threshold separates "written twice" from "said twice differently",
# and a checker that guessed would be argued with instead of read.
set -euo pipefail

# What counts as repeated: a run of this many consecutive words, in two places.
#
# Seven, measured rather than chosen. docs/notes/2026-11-20-repeated-prose.md
# holds the numbers: every run of eight words or more was a real copy, and
# everything at six or below was the domain's own vocabulary. Seven is the gap,
# with a word of margin on the shortest real copy.
WORDS=7

base=""
files=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="${2:?--base needs a ref}"; shift 2 ;;
    --words) WORDS="${2:?--words needs a count}"; shift 2 ;;
    -h|--help) sed -n '2,38p' "$0"; exit 0 ;;
    *) files+=("$1"); shift ;;
  esac
done

# One record per line, from wherever it came:
#
#   source <TAB> line number <TAB> text
#
# Both producers below emit that shape, so the awk program does not know
# whether it is reading a diff or a file. The line numbers are kept because
# consecutive ones are what reassembles a wrapped paragraph.
records=$(
  if [ -z "$base" ]; then
    # The base the pull request will use: `federation` where it exists, `main`
    # in a repository without one yet.
    if git rev-parse --verify --quiet origin/federation >/dev/null; then
      base=origin/federation
    else
      base=origin/main
    fi
  fi
  echo "# added lines, against $base, and any file named" >&2

  git diff --unified=0 "$base...HEAD" | awk '
    /^\+\+\+ b\// { file = substr($0, 7); next }
    /^@@/         { split($0, a, "+"); split(a[2], b, /[ ,]/); line = b[1]; next }
    /^\+/         { printf "%s\t%s\t%s\n", file, line++, substr($0, 2) }
  '

  # A `for` over the arguments rather than a `while read` over a list: the
  # loop body has to inherit this script's standard input, and a `while read`
  # loop's is the list it is reading. That is what silently emptied `-`.
  for f in ${files[@]+"${files[@]}"}; do
    if [ "$f" = "-" ]; then
      awk '{ printf "(stdin)\t%s\t%s\n", FNR, $0 }'
    else
      awk '{ printf "%s\t%s\t%s\n", FILENAME, FNR, $0 }' "$f"
    fi
  done
)

hits=$(
  printf '%s\n' "$records" | awk -F'\t' -v want="$WORDS" '
    # ---- what counts as prose -------------------------------------------
    #
    # In a document, every line. In a source file, only comments and
    # docstrings: a fixture that reads like a sentence (`gh pr create --title
    # ...`) is prose by every ratio and by no other measure, and an import
    # block repeated across two test files is not a narrative written twice.
    # So the file decides first, and the ratio only sorts what is left.

    function is_document(s) { return s ~ /\.(md|markdown|txt|rst)$|^\(stdin\)$/ }
    function is_comment(s)  { return s ~ /^[ \t]*(#|\/\/|\/\*|\*|<!--|--|;|%)/ }

    # Comment and Markdown markers, off the front and the back. Language by
    # language is not worth it: what survives the obvious ones is prose, or the
    # ratio below drops it.
    function strip(s) {
      sub(/^[ \t]*("""|'\'''\'''\'')/, "", s)
      while (match(s, /^[ \t]*(\/\/+|\/\*|\*\/|<!--|-->|#+|--+|;+|%+|>+|\*|\+|-|[0-9]+\.)[ \t]+/))
        s = substr(s, RLENGTH + 1)
      sub(/^[ \t]*(\/\/+|\/\*|\*\/|<!--|-->|#+|;+|%+)[ \t]*/, "", s)
      sub(/[ \t]*(\*\/|-->|"""|'\'''\'''\'')[ \t]*$/, "", s)
      gsub(/^[ \t]+|[ \t]+$/, "", s)
      return s
    }

    # Inline code is not prose, and it is what makes an identifier look like a
    # word. Out before the ratio and out before the comparison, so two
    # paragraphs are never alike for naming the same variable.
    function uncode(s) { gsub(/`[^`]*`/, " ", s); return s }

    # Counted on tokens, not characters: an identifier is one long token and a
    # sentence is many short ones.
    function is_prose(s,   n, i, t, words, parts) {
      s = uncode(s)
      if (s ~ /[{}]|==|=>|->|::|\$\(|--[a-z]/) return 0
      n = split(s, parts, /[ \t]+/)
      if (n < 3) return 0
      words = 0
      for (i = 1; i <= n; i++) {
        t = parts[i]
        gsub(/^[^A-Za-z]+|[^A-Za-z]+$/, "", t)
        if (t ~ /^[A-Za-z]+$/ && length(t) > 1) words++
      }
      return words / n >= 0.6
    }

    function normalise(s) {
      s = tolower(uncode(s))
      gsub(/[^a-z0-9]+/, " ", s)
      gsub(/^ +| +$/, "", s)
      return s
    }

    # ---- paragraphs ------------------------------------------------------
    #
    # The step that earns its keep. Prose is wrapped, and wrapping is where a
    # copy hides: the same sentence broken at another column shares no line
    # with its original, and two copies do not break into sentences at the same
    # places either. Contiguous prose lines are joined back into the paragraph
    # somebody wrote, and the comparison runs over words from there on, so no
    # boundary of ours decides what matches.

    function close_paragraph(   n, i) {
      if (para == "") return
      n = split(normalise(para), w, " ")
      if (n >= want) {
        count++
        src[count] = para_src; ln[count] = para_line; len[count] = n
        for (i = 1; i <= n; i++) word[count, i] = w[i]
      }
      para = ""
    }

    {
      this_src = $1; this_line = $2 + 0
      rest = substr($0, index($0, "\t") + 1)
      raw = substr(rest, index(rest, "\t") + 1)

      if (this_src != para_src) in_docstring = 0

      # A docstring is prose in a file whose other lines are not. The toggle
      # sees only what the diff added, so a one-line edit inside a docstring
      # whose opening is not in the diff reads as code and is skipped. That is
      # the right failure: one line is not a narrative written twice.
      quotes = gsub(/"""|'\'''\'''\''/, "&", raw)
      opened = in_docstring || raw ~ /"""|'\'''\'''\''/
      if (quotes % 2 == 1) in_docstring = !in_docstring

      line = strip(raw)
      if (!(is_document(this_src) || is_comment(raw) || opened) || !is_prose(line)) {
        close_paragraph(); para_src = this_src; next_line = -1; next
      }
      if (this_src != para_src || this_line != next_line) {
        close_paragraph()
        para_src = this_src; para_line = this_line
      }
      para = (para == "") ? line : para " " line
      next_line = this_line + 1
    }

    # ---- the pairs -------------------------------------------------------
    #
    # A pair shares a run of `want` words exactly when it shares one window of
    # that length, so an index over windows finds every candidate in one pass
    # and the quadratic walk only runs over what the index already matched.
    # Then the run is extended, because its length is what sorts the report:
    # twelve words in common is a copy, seven is an argument.

    function longest_run(p, q,   i, j, here, best, prev_row, this_row) {
      best = 0
      for (i = 1; i <= len[p]; i++) {
        for (j = 1; j <= len[q]; j++) {
          here = (word[p, i] == word[q, j]) ? prev_row[j - 1] + 1 : 0
          this_row[j] = here
          if (here > best) { best = here; end_p = i }
        }
        for (j = 0; j <= len[q]; j++) prev_row[j] = this_row[j]
      }
      return best
    }

    function quote(p, from, n,   i, s) {
      s = word[p, from]
      for (i = from + 1; i < from + n; i++) s = s " " word[p, i]
      return s
    }

    END {
      # Every paragraph on a window, not just the first: a narrative written
      # three times shares its windows three ways, and keeping only the first
      # would hide the pair between copies two and three.
      for (p = 1; p <= count; p++)
        for (i = 1; i <= len[p] - want + 1; i++) {
          key = quote(p, i, want)
          if (key in window) {
            n = split(window[key], seen, " ")
            for (m = 1; m <= n; m++)
              if (seen[m] != p) candidate[seen[m] "," p] = 1
            if (seen[n] != p) window[key] = window[key] " " p
          } else window[key] = p
        }

      for (pair in candidate) {
        split(pair, ends, ",")
        p = ends[1]; q = ends[2]
        n = longest_run(p, q)
        printf "%03d\t%s:%s\t%s:%s\t%s\n", n, src[p], ln[p], src[q], ln[q],
          quote(p, end_p - n + 1, n)
      }
    }
  ' | sort -rn | awk -F'\t' '{ printf "%d words  %s  <->  %s\n    \"%s\"\n", $1, $2, $3, $4 }'
)

if [ -z "$hits" ]; then
  echo "nothing written twice."
  exit 0
fi
printf '%s\n' "$hits"
echo >&2
echo "Prose written more than once. It goes once: docs/agents/external-repos.md." >&2
exit 1
