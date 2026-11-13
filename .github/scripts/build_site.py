#!/usr/bin/env python3
"""저장소의 HTML을 GitHub Pages용 폴더(_site)로 모읍니다.

- 저장소의 모든 .html을 같은 경로로 복사합니다 (dev/, .git, node_modules, 제외 목록은 뺍니다).
- html이 상대경로로 참조하는 파일(이미지, 다른 문서 등)도 같은 경로로 함께 복사합니다.
- 모든 html의 <title>을 읽어 목차(index.html)를 만듭니다.
- 사용: python3 .github/scripts/build_site.py [--out _site]
"""
import argparse
import fnmatch
import html
import os
import re
import shutil
import sys
from urllib.parse import quote, unquote, urlsplit

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SKIP_DIRS = {".git", "node_modules", "_site", "dev"}
EXCLUDE_FILE = os.path.join(ROOT, ".github", "site", "exclude.txt")
REF_RE = re.compile(r"""(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']""", re.I)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
DESC_RE = re.compile(r"""<meta\s+name=["']description["']\s+content=["']([^"']*)["']""", re.I)

# 목차에서 보여 줄 대분류 이름과 순서 (CLAUDE.md 폴더 구조 기준과 맞춥니다)
GROUPS = [
    ("presentation", "발표"),
    ("plan", "기획"),
    ("brand", "브랜드·콘텐츠"),
    ("storyboard", "스토리보드"),
    ("research", "리서치"),
    ("archive", "보관"),
]


def load_excludes():
    pats = []
    if os.path.exists(EXCLUDE_FILE):
        for line in open(EXCLUDE_FILE, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#"):
                pats.append(line)
    return pats


def is_excluded(rel, pats):
    return any(fnmatch.fnmatch(rel, p) or rel.startswith(p.rstrip("/") + "/") for p in pats)


def find_html(pats):
    found = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for f in sorted(files):
            if f.lower().endswith(".html"):
                rel = os.path.relpath(os.path.join(base, f), ROOT).replace(os.sep, "/")
                if not is_excluded(rel, pats):
                    found.append(rel)
    return found


def local_refs(rel):
    """html 하나가 참조하는 저장소 안의 파일 경로(루트 기준)를 돌려줍니다. 없는 파일은 missing에 모읍니다."""
    text = open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace").read()
    found, missing = set(), set()
    for raw in REF_RE.findall(text):
        parts = urlsplit(raw.strip())
        if parts.scheme or parts.netloc or raw.startswith(("#", "//", "data:", "mailto:", "javascript:")):
            continue
        if not parts.path:
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(rel), unquote(parts.path)))
        if target.startswith(".."):
            missing.add(raw)
            continue
        target = target.replace(os.sep, "/")
        if os.path.isfile(os.path.join(ROOT, target)):
            found.add(target)
        else:
            missing.add(raw)
    return found, missing


def page_info(rel):
    text = open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace").read()
    m = TITLE_RE.search(text)
    title = html.unescape(re.sub(r"\s+", " ", m.group(1)).strip()) if m else ""
    d = DESC_RE.search(text)
    return title or os.path.basename(rel), html.unescape(d.group(1)) if d else "", bool(m)


def group_of(rel):
    top = rel.split("/")[0]
    for key, label in GROUPS:
        if top == key:
            return label
    return "기타"


def make_index(pages):
    order = [label for _, label in GROUPS] + ["기타"]
    by_group = {}
    for p in pages:
        by_group.setdefault(group_of(p["path"]), []).append(p)
    sections = []
    for label in order:
        items = by_group.get(label)
        if not items:
            continue
        rows = []
        for p in items:
            href = quote(p["path"])
            desc = f'<span class="desc">{html.escape(p["desc"])}</span>' if p["desc"] else ""
            rows.append(
                f'<li data-q="{html.escape((p["title"] + " " + p["path"]).lower())}">'
                f'<a href="{href}">{html.escape(p["title"])}</a>{desc}'
                f'<code>{html.escape(p["path"])}</code></li>'
            )
        sections.append(
            f'<section><h2>{html.escape(label)} <small>{len(items)}</small></h2><ul>{"".join(rows)}</ul></section>'
        )
    return INDEX_TEMPLATE.replace("__SECTIONS__", "\n".join(sections)).replace("__COUNT__", str(len(pages)))


INDEX_TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TREAGENT 자료 모음</title>
<meta name="description" content="TREAGENT 저장소의 HTML 자료 목차">
<style>
  :root { --bg:#fbf6ee; --card:#ffffff; --text:#2b2320; --muted:#7a6d64; --line:#e8ddd0; --accent:#a8242a; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#1d1917; --card:#27211e; --text:#f1e9e2; --muted:#a99c92; --line:#3a312c; --accent:#ee8a8f; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Noto Sans KR","Apple SD Gothic Neo",sans-serif; }
  main { max-width:860px; margin:0 auto; padding:32px 16px 64px; }
  h1 { margin:0 0 4px; font-size:1.6rem; }
  .sub { margin:0 0 20px; color:var(--muted); }
  input { width:100%; padding:10px 14px; font-size:1rem; color:var(--text); background:var(--card);
          border:1px solid var(--line); border-radius:10px; }
  section { margin-top:28px; }
  h2 { font-size:1.1rem; margin:0 0 8px; color:var(--accent); }
  h2 small { color:var(--muted); font-weight:400; }
  ul { list-style:none; margin:0; padding:0; background:var(--card); border:1px solid var(--line); border-radius:12px; }
  li { padding:10px 14px; border-top:1px solid var(--line); }
  li:first-child { border-top:0; }
  li a { color:var(--text); font-weight:600; text-decoration:none; }
  li a:hover { color:var(--accent); text-decoration:underline; }
  .desc { display:block; color:var(--muted); font-size:.9rem; }
  code { display:block; color:var(--muted); font-size:.78rem; word-break:break-all; }
  .hide { display:none; }
  footer { margin-top:32px; color:var(--muted); font-size:.85rem; }
</style>
</head>
<body>
<main>
  <h1>TREAGENT 자료 모음</h1>
  <p class="sub">저장소의 HTML __COUNT__개를 폴더별로 모았습니다. 목차는 <code style="display:inline">main</code>에 병합될 때마다 자동으로 다시 만들어집니다.</p>
  <input id="q" type="search" placeholder="제목이나 경로로 찾기" aria-label="검색">
__SECTIONS__
  <footer>프로젝트 설명과 문서 안내는 저장소 README를 봐 주세요.</footer>
</main>
<script>
  var q = document.getElementById('q');
  q.addEventListener('input', function () {
    var v = q.value.trim().toLowerCase();
    document.querySelectorAll('li[data-q]').forEach(function (li) {
      li.classList.toggle('hide', v && li.getAttribute('data-q').indexOf(v) < 0);
    });
    document.querySelectorAll('section').forEach(function (s) {
      s.classList.toggle('hide', !s.querySelector('li:not(.hide)'));
    });
  });
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="_site")
    out = os.path.abspath(ap.parse_args().out)
    pats = load_excludes()
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)

    pages = find_html(pats)
    if not pages:
        print("HTML 파일이 없습니다.", file=sys.stderr)
        sys.exit(1)

    copy, warnings, info, no_title = set(pages), [], [], []
    for rel in pages:
        refs, missing = local_refs(rel)
        for r in refs:
            if not is_excluded(r, pats):
                copy.add(r)
        for m in missing:
            warnings.append(f"{rel}: 없는 파일 참조 '{m}'")
        title, desc, has_title = page_info(rel)
        if not has_title:
            no_title.append(rel)
        info.append({"path": rel, "title": title, "desc": desc})

    for rel in sorted(copy):
        dst = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, rel), dst)

    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(make_index(info))
    open(os.path.join(out, ".nojekyll"), "w").close()

    size = sum(os.path.getsize(os.path.join(b, f)) for b, _, fs in os.walk(out) for f in fs)
    print(f"html {len(pages)}개, 함께 복사한 참조 파일 {len(copy) - len(pages)}개, 합계 {size / 1024 / 1024:.1f}MB -> {out}")
    for w in warnings:
        print("경고:", w)
    for n in no_title:
        print("경고: <title> 없음 (파일명을 제목으로 씀):", n)


if __name__ == "__main__":
    main()
