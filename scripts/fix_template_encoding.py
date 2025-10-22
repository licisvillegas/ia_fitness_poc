from __future__ import annotations

from pathlib import Path
import argparse


def ensure_utf8(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    raw = path.read_bytes()
    try:
        # If this succeeds, file is already UTF-8
        raw.decode("utf-8")
        print(f"Already UTF-8: {path}")
        return
    except UnicodeDecodeError:
        pass

    # Try common Windows legacy encodings first (cp1252 covers á, é, í, ó, ú, ñ, etc.)
    for encoding in ("cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            # Backup original
            backup = path.with_suffix(path.suffix + ".bak")
            backup.write_bytes(raw)
            # Write UTF-8 without BOM
            path.write_text(text, encoding="utf-8", newline="\n")
            print(f"Converted {path} from {encoding} to UTF-8. Backup: {backup}")
            return
        except UnicodeDecodeError:
            continue

    raise UnicodeError(
        f"Could not decode {path} using common legacy encodings; manual inspection required."
    )


def iter_html_files(root: Path):
    if root.is_file():
        if root.suffix.lower() == ".html" and not root.name.endswith(".bak"):
            yield root
        return
    for p in root.rglob("*.html"):
        if not p.name.endswith(".bak"):
            yield p


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ensure templates are UTF-8 encoded.")
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Files or directories to process (defaults to 'templates').",
    )
    args = parser.parse_args()

    targets = args.paths or [Path("templates")]
    count = 0
    for t in targets:
        for html in iter_html_files(t):
            try:
                ensure_utf8(html)
                count += 1
            except Exception as e:
                print(f"[WARN] {html}: {e}")
    print(f"Processed {count} file(s).")
