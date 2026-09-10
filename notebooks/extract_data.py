#!/usr/bin/env python3
"""Stream the source data for an osu! Beatmap Atlas embedding build."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
import time
from pathlib import Path
from typing import Iterable, Sequence

import pyarrow as pa
import pyarrow.parquet as pq
import pymysql
from pymysql.cursors import SSCursor


HISCORE_COLUMNS = ("user", "beatmap_id", "pp", "mods", "update_time")
HISCORE_SCHEMA = pa.schema(
    [
        pa.field("user", pa.int32(), nullable=False),
        pa.field("beatmap_id", pa.int32(), nullable=False),
        pa.field("pp", pa.float64(), nullable=False),
        pa.field("mods", pa.int32(), nullable=False),
        pa.field("update_time", pa.timestamp("us"), nullable=False),
    ]
)

BEATMAP_COLUMNS = (
    "id",
    "beatmapset_id",
    "beatmap_id",
    "approved",
    "approved_date",
    "last_update",
    "total_length",
    "hit_length",
    "version",
    "artist",
    "title",
    "creator",
    "bpm",
    "source",
    "difficultyrating",
    "diff_size",
    "diff_overall",
    "diff_approach",
    "diff_drain",
    "mode",
)
BEATMAP_SCHEMA = pa.schema(
    [
        # Preserve the schema expected by the existing Rust corpus builder.
        pa.field("id", pa.float64()),
        pa.field("beatmapset_id", pa.int64(), nullable=False),
        pa.field("beatmap_id", pa.int64(), nullable=False),
        pa.field("approved", pa.int64(), nullable=False),
        pa.field("approved_date", pa.timestamp("ns")),
        pa.field("last_update", pa.timestamp("ns"), nullable=False),
        pa.field("total_length", pa.int64(), nullable=False),
        pa.field("hit_length", pa.int64(), nullable=False),
        pa.field("version", pa.string(), nullable=False),
        pa.field("artist", pa.string(), nullable=False),
        pa.field("title", pa.string(), nullable=False),
        pa.field("creator", pa.string(), nullable=False),
        pa.field("bpm", pa.int64(), nullable=False),
        pa.field("source", pa.string(), nullable=False),
        pa.field("difficultyrating", pa.float64(), nullable=False),
        pa.field("diff_size", pa.int64(), nullable=False),
        pa.field("diff_overall", pa.int64(), nullable=False),
        pa.field("diff_approach", pa.int64(), nullable=False),
        pa.field("diff_drain", pa.int64(), nullable=False),
        pa.field("mode", pa.int64(), nullable=False),
    ]
)
BEATMAP_SUPPLEMENT = Path(__file__).with_name("beatmap_metadata_supplement.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data"),
        help="Destination directory (default: data)",
    )
    parser.add_argument(
        "--only",
        choices=("all", "hiscores", "beatmaps"),
        default="all",
        help="Export one table or both (default: all)",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=250_000,
        help="Rows per Parquet row group (default: 250000)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit each query; intended only for testing the exporter",
    )
    return parser.parse_args()


def connect() -> pymysql.Connection:
    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.getenv("DB_DATABASE", "osutrack_migration"),
        charset="utf8mb4",
        autocommit=True,
        cursorclass=SSCursor,
        connect_timeout=10,
        read_timeout=12 * 60 * 60,
        write_timeout=60,
    )


def rows_to_table(
    rows: Sequence[Sequence[object]], schema: pa.Schema
) -> pa.Table:
    columns: Iterable[Sequence[object]] = zip(*rows)
    arrays = [
        pa.array(values, type=field.type) for values, field in zip(columns, schema)
    ]
    return pa.Table.from_arrays(arrays, schema=schema)


def stream_query_to_parquet(
    *,
    query: str,
    destination: Path,
    schema: pa.Schema,
    chunk_size: int,
    trailing_rows: Sequence[Sequence[object]] = (),
) -> int:
    partial = destination.with_name(f".{destination.name}.partial")
    partial.unlink(missing_ok=True)
    started_at = time.monotonic()
    row_count = 0

    try:
        with connect() as connection, connection.cursor() as cursor:
            cursor.execute(query)
            with pq.ParquetWriter(
                partial,
                schema,
                compression="zstd",
                compression_level=6,
                write_statistics=True,
            ) as writer:
                while rows := cursor.fetchmany(chunk_size):
                    writer.write_table(rows_to_table(rows, schema))
                    row_count += len(rows)
                    elapsed = time.monotonic() - started_at
                    rate = row_count / elapsed if elapsed else 0
                    print(
                        f"{destination.name}: {row_count:,} rows "
                        f"({rate:,.0f} rows/sec)",
                        flush=True,
                    )
                if trailing_rows:
                    writer.write_table(rows_to_table(trailing_rows, schema))
                    row_count += len(trailing_rows)
    except Exception:
        print(f"Partial export retained at {partial}", flush=True)
        raise

    partial.replace(destination)
    elapsed = time.monotonic() - started_at
    print(
        f"Wrote {row_count:,} rows to {destination} in {elapsed / 60:.1f} minutes",
        flush=True,
    )
    return row_count


def load_beatmap_supplement() -> list[tuple[object, ...]]:
    if not BEATMAP_SUPPLEMENT.exists():
        return []
    with BEATMAP_SUPPLEMENT.open() as source:
        records = json.load(source)
    for record in records:
        for field in ("approved_date", "last_update"):
            record[field] = datetime.fromisoformat(record[field].replace("Z", "+00:00"))
    return [tuple(record[column] for column in BEATMAP_COLUMNS) for record in records]


def with_limit(query: str, limit: int | None) -> str:
    if limit is None:
        return query
    if limit <= 0:
        raise ValueError("--limit must be positive")
    return f"{query} LIMIT {limit:d}"


def main() -> None:
    args = parse_args()
    if args.chunk_size <= 0:
        raise ValueError("--chunk-size must be positive")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    if args.only in ("all", "hiscores"):
        # pp matches almost half the table, so MariaDB's sequential scan is much
        # cheaper than millions of non-covering lookups through the pp index.
        hiscore_query = with_limit(
            "SELECT user, beatmap_id, pp, mods, update_time "
            "FROM hiscore_updates IGNORE INDEX (pp) "
            "WHERE mode = 0 AND pp >= 75",
            args.limit,
        )
        stream_query_to_parquet(
            query=hiscore_query,
            destination=args.output_dir / "hiscore_updates.parquet",
            schema=HISCORE_SCHEMA,
            chunk_size=args.chunk_size,
        )

    if args.only in ("all", "beatmaps"):
        beatmap_query = with_limit(
            "SELECT id, beatmapset_id, beatmap_id, approved, approved_date, "
            "last_update, total_length, hit_length, version, artist, title, "
            "creator, bpm, source, difficultyrating, CAST(diff_size AS SIGNED), "
            "CAST(diff_overall AS SIGNED), CAST(diff_approach AS SIGNED), "
            "CAST(diff_drain AS SIGNED), mode FROM beatmaps",
            args.limit,
        )
        # One row group preserves compatibility with the current corpus builder.
        stream_query_to_parquet(
            query=beatmap_query,
            destination=args.output_dir / "beatmaps.parquet",
            schema=BEATMAP_SCHEMA,
            chunk_size=max(args.chunk_size, 500_000),
            trailing_rows=load_beatmap_supplement(),
        )


if __name__ == "__main__":
    main()
