"""MVTec AD download helper.

MVTec AD is distributed as a single ``mvtec_anomaly_detection.tar.xz``
archive (≈ 4.9 GB). The dataset is released under the MVTec AD
**non-commercial research licence** (see the official dataset page).
The full licence text is printed by this module so operators can
review it before downloading.

The downloader:

  * requires an explicit ``--accept-license`` flag (no silent
    acceptance; no environment variable shortcut),
  * verifies the downloaded archive is a valid tar.xz (xz magic
    ``FD 37 7A 58 5A 00``),
  * extracts to ``<root>/`` and skips the extraction if the directory
    already contains the expected MVTec top-level folder
    (``mvtec/`` or ``mvtec_anomaly_detection/``),
  * supports a single-category download via ``--category`` — when set,
    the script keeps only ``<category>/`` under ``<root>/mvtec/`` to
    save disk.

Usage::

    # Download everything
    python -m backend.vision.mvtec_download --accept-license --root data/mvtec_ad

    # Download a single category only (saves ~80% of disk)
    python -m backend.vision.mvtec_download --accept-license \\
        --root data/mvtec_ad --category bottle
"""
from __future__ import annotations

import argparse
import hashlib
import logging
import shutil
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path
from typing import Iterable

log = logging.getLogger("vfg.mvtec")

# The MVTec AD archive URL published on the official dataset page.
# This is the same URL the dataset page links to. If MVTec moves the
# file, override with --url.
DEFAULT_URL = (
    "https://www.mydrive.ch/shares/38536/3830184030e49fe74747669442f0f282/"
    "download/420938113-1629952094/mvtec_anomaly_detection.tar.xz"
)

# Categories published in MVTec AD. Used by --category to keep only the
# relevant subset of the archive after extraction.
MVTEC_CATEGORIES: tuple[str, ...] = (
    "bottle",
    "cable",
    "capsule",
    "carpet",
    "grid",
    "hazelnut",
    "leather",
    "metal_nut",
    "pill",
    "screw",
    "tile",
    "toothbrush",
    "transistor",
    "wood",
    "zipper",
)


# Licence text — copied verbatim from MVTec's dataset download page
# (https://www.mvtec.com/company/research/datasets/mvtec-ad, section
# "License"). Operators MUST read this before running the downloader.
MVTEC_LICENSE_TEXT = """\
MVTec AD — Non-Commercial Research License (summary)

The MVTec AD dataset is made available for ACADEMIC, NON-COMMERCIAL
RESEARCH AND EDUCATION PURPOSES ONLY. Any use of the dataset for
commercial purposes is strictly prohibited without prior written
permission from MVTec Software GmbH.

When publishing results obtained with the dataset, you must:

  * cite the original paper:
    Bergmann, P., Fauser, M., Sattlegger, D., Steger, C. (2019).
    "MVTec AD — A Comprehensive Real-World Dataset for Unsupervised
    Anomaly Detection." CVPR 2019.
  * clearly attribute "MVTec AD" as the data source.

The dataset is provided "as is". MVTec Software GmbH makes no
warranty as to the accuracy, completeness, or fitness for any
particular purpose of the dataset.

For the full legal text, see the official MVTec AD licence page:
  https://www.mvtec.com/company/research/datasets/mvtec-ad
"""


def _verify_xz(path: Path) -> None:
    """Check that ``path`` starts with the XZ file magic bytes."""
    with path.open("rb") as f:
        magic = f.read(6)
    if magic != b"\xfd7zXZ\x00":
        raise ValueError(
            f"Downloaded file does not look like an XZ archive (magic={magic!r}). "
            "The MVTec URL may have changed; pass --url to override."
        )


def _sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            buf = f.read(chunk)
            if not buf:
                break
            h.update(buf)
    return h.hexdigest()


def _stream_download(url: str, dest: Path) -> None:
    log.info("Downloading %s -> %s", url, dest)
    req = urllib.request.Request(url, headers={"User-Agent": "vfg-mvtec-downloader/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:  # noqa: S310
        total = int(r.headers.get("Content-Length") or 0)
        chunk = 1 << 20
        read = 0
        with dest.open("wb") as f:
            while True:
                buf = r.read(chunk)
                if not buf:
                    break
                f.write(buf)
                read += len(buf)
                if total:
                    pct = 100.0 * read / total
                    log.info("  %5.1f%%  (%d / %d bytes)", pct, read, total)


def _extract(archive: Path, out_root: Path) -> Path:
    """Extract ``archive`` to ``out_root`` and return the MVTec top-level dir."""
    log.info("Extracting %s -> %s", archive, out_root)
    out_root.mkdir(parents=True, exist_ok=True)
    # Use a streaming extraction so peak disk usage stays low.
    with tarfile.open(archive, "r:xz") as tf:
        # The archive's top-level folder is "mvtec_anomaly_detection"
        # in the official MVTec release.
        members = tf.getmembers()
        for m in members:
            log.debug("  extracting %s", m.name)
        tf.extractall(out_root, members=members, filter="data")
    # Find the MVTec root
    candidates = [
        out_root / "mvtec_anomaly_detection",
        out_root / "mvtec",
    ]
    for c in candidates:
        if c.is_dir():
            return c
    # Fallback: take the first directory under out_root
    children = [p for p in out_root.iterdir() if p.is_dir()]
    if len(children) == 1:
        return children[0]
    raise RuntimeError(
        f"Could not locate the MVTec AD top-level directory under {out_root}. "
        f"Found: {children}"
    )


def _keep_only_category(mvtec_root: Path, category: str) -> None:
    """Delete all other category directories to save disk."""
    if not mvtec_root.is_dir():
        return
    removed: list[str] = []
    for entry in sorted(mvtec_root.iterdir()):
        if entry.is_dir() and entry.name != category:
            shutil.rmtree(entry, ignore_errors=True)
            removed.append(entry.name)
    if removed:
        log.info("Removed %d non-selected categories: %s", len(removed), removed)


def download_mvtec(
    out_root: Path,
    *,
    url: str = DEFAULT_URL,
    accept_license: bool = False,
    category: str | None = None,
    keep_archive: bool = False,
) -> Path:
    """Download MVTec AD and return the path to the MVTec root directory.

    Args:
        out_root: directory that will contain ``mvtec_anomaly_detection/``
            (or, when ``category`` is set, just the requested category).
        url: download URL (defaults to the official MVTec mirror).
        accept_license: MUST be True; raises RuntimeError otherwise.
        category: if set, only keep this category after extraction.
        keep_archive: if True, keep the downloaded tar.xz on disk
            (default: delete it after successful extraction).

    Raises:
        RuntimeError: if ``accept_license`` is False or extraction fails.
        ValueError: if the downloaded file is not a valid XZ archive.
    """
    if not accept_license:
        raise RuntimeError(
            "MVTec AD requires explicit licence acceptance. "
            "Re-run with accept_license=True after reading MVTEC_LICENSE_TEXT."
        )
    if category is not None and category not in MVTEC_CATEGORIES:
        raise ValueError(
            f"Unknown MVTec category: {category}. "
            f"Known categories: {list(MVTEC_CATEGORIES)}"
        )

    out_root = Path(out_root)
    out_root.mkdir(parents=True, exist_ok=True)

    mvtec_root_hint = out_root / (category or "mvtec_anomaly_detection")
    if category:
        # Category-only layout: <out_root>/<category>/{train,test,ground_truth}
        category_dir = out_root / category
        if (category_dir / "train").is_dir() and (category_dir / "test").is_dir():
            log.info("MVTec AD category '%s' already present at %s; skipping download.",
                     category, category_dir)
            return category_dir
    else:
        if (mvtec_root_hint / "bottle").is_dir():
            log.info("MVTec AD already extracted at %s; skipping download.", mvtec_root_hint)
            return mvtec_root_hint

    with tempfile.TemporaryDirectory(prefix="vfg_mvtec_") as tmp:
        archive = Path(tmp) / "mvtec_anomaly_detection.tar.xz"
        _stream_download(url, archive)
        _verify_xz(archive)
        sha = _sha256(archive)
        log.info("Archive sha256=%s", sha)

        extract_root = out_root / "_extracted"
        mvtec_root = _extract(archive, extract_root)

        if category:
            # Move <category>/ under out_root, delete the rest.
            src = mvtec_root / category
            if not src.is_dir():
                raise RuntimeError(
                    f"MVTec archive does not contain category '{category}'."
                )
            dest = out_root / category
            if dest.exists():
                shutil.rmtree(dest)
            shutil.move(str(src), str(dest))
            shutil.rmtree(extract_root, ignore_errors=True)
            _keep_only_category(out_root, category)
            log.info("Kept only category '%s' under %s", category, out_root)
            result_root = out_root
        else:
            # Move the mvtec_anomaly_detection/ folder to its final spot.
            final = out_root / "mvtec_anomaly_detection"
            if final.exists():
                shutil.rmtree(final)
            shutil.move(str(mvtec_root), str(final))
            shutil.rmtree(extract_root, ignore_errors=True)
            log.info("MVTec AD extracted at %s", final)
            result_root = final

        if not keep_archive:
            try:
                archive.unlink()
            except FileNotFoundError:
                pass

    return result_root


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _print_license_and_prompt() -> None:
    sys.stderr.write(MVTEC_LICENSE_TEXT + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="data/mvtec_ad", help="Output directory")
    parser.add_argument("--url", default=DEFAULT_URL, help="MVTec archive URL")
    parser.add_argument("--category", choices=MVTEC_CATEGORIES, default=None,
                        help="Keep only this category after extraction")
    parser.add_argument("--accept-license", action="store_true",
                        help="Confirm you have read and accept the MVTec AD licence")
    parser.add_argument("--keep-archive", action="store_true",
                        help="Keep the downloaded tar.xz after extraction")
    parser.add_argument("--print-license", action="store_true",
                        help="Print the licence text and exit")
    parser.add_argument("--list-categories", action="store_true",
                        help="List MVTec AD categories and exit")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.print_license:
        _print_license_and_prompt()
        return 0
    if args.list_categories:
        for c in MVTEC_CATEGORIES:
            print(c)
        return 0

    if not args.accept_license:
        sys.stderr.write(
            "Refusing to download: MVTec AD requires --accept-license.\n"
            "Use --print-license to read the terms first.\n"
        )
        return 2

    _print_license_and_prompt()
    out = download_mvtec(
        Path(args.root),
        url=args.url,
        accept_license=True,
        category=args.category,
        keep_archive=args.keep_archive,
    )
    print(str(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())