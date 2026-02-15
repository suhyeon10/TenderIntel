"""Reindex tenders into tender-level and chunk-level indexes."""

import argparse

from core.indexing.repository import SupabaseIndexingRepository
from core.indexing.service import TenderIndexingService


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=None, help="Optional source filter")
    args = parser.parse_args()

    service = TenderIndexingService(SupabaseIndexingRepository())
    stats = service.reindex(source=args.source)

    print(
        {
            "source": args.source,
            "scanned": stats.scanned,
            "indexed_documents": stats.indexed_documents,
            "indexed_chunks": stats.indexed_chunks,
            "skipped_documents": stats.skipped_documents,
        }
    )


if __name__ == "__main__":
    main()
