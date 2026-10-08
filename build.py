"""Builds the single-file game from src/.

dist/puzzle-triathlon.html  page content as published to Claude (no <html>/<head> wrapper)
dist/index.html             standalone page: open it in any modern browser to play offline
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, DIST = ROOT / "src", ROOT / "dist"
FONTS = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800"
         "&family=Figtree:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap")


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def main() -> None:
    page = (
        "<title>Puzzle Triathlon</title>\n"
        f'<link rel="stylesheet" href="{FONTS}">\n'
        f"<style>\n{read('style.css')}</style>\n"
        f"{read('body.html')}\n"
        f'<script id="engines">\n{read("engines.js")}</script>\n'
        f"<script>\n{read('app.js')}</script>\n"
    )
    assert page.count("</script>") == 2, "a source file contains a literal </script>"
    DIST.mkdir(exist_ok=True)
    (DIST / "puzzle-triathlon.html").write_text(page, encoding="utf-8")
    standalone = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        "<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>"
        f"</head><body>{page}</body></html>\n"
    )
    (DIST / "index.html").write_text(standalone, encoding="utf-8")
    print(f"built dist/puzzle-triathlon.html and dist/index.html ({len(page):,} bytes)")


if __name__ == "__main__":
    main()
