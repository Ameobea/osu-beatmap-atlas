//! Generates the binary corpus file which will be loaded by the frontend to display the embedding
//! visualization and associated metadata.
//!
//! The corpus file is a custom binary format which starts with a [u32] indicating the number of
//! items in the embedding.  This is then followed by that number of fixed-width rows.  After that,
//! there is a dynamically sized region containing string data which is referenced by the data rows.
//!
//! Each data row contains the following fields:
//!
//! [u32] beatmap_id
//! [u32] mods bitmask
//! [f32, f32] [x, y] coordinates of embedded point
//! [f32] average pp
//! [f32] star rating
//! [u16] length of beatmap name from string region
//! [u16] length of difficulty name from string region
//! [u16] length of mapper name from string region
//! [u16] release year
//! [u16] length seconds
//! [u16] bpm
//! [f32] AR
//! [f32] CS
//! [f32] OD
//! [f32] aim difficulty
//! [f32] speed difficulty
//! [u32] beatmapset id
//! [u16] user count
//!
//! The string region starts at (row_size_bytes) * (number_of_rows) + 4 bytes from the start of the
//! file. Each string is _not_ null-terminated and is stored as a sequence of UTF-8 bytes end to
//! end.  When parsing rows, a pointer should be initialized to the start of the string region and
//! incremented by the length of each string field in each row as they are parsed.

use std::{path::Path, str::FromStr};

use chrono::{DateTime, Datelike, Utc};
use foundations::telemetry::log::*;
use fxhash::FxHashMap;
use parquet::{
  file::reader::{FileReader, SerializedFileReader},
  record::RowAccessor,
};
use rosu_v2::model::GameMods;

use crate::{DifficultyRecord, ScoreMetadata};

// beatmap metadata:
// +------------------+--------------+------+-----+---------+-------+
// | Field            | Type         | Null | Key | Default | Extra |
// +------------------+--------------+------+-----+---------+-------+
// | id               | int(11)      | YES  |     | NULL    |       |
// | beatmapset_id    | int(10)      | NO   |     | NULL    |       |
// | beatmap_id       | int(10)      | NO   | MUL | NULL    |       |
// | approved         | int(10)      | NO   |     | NULL    |       |
// | approved_date    | datetime     | YES  |     | NULL    |       |
// | last_update      | datetime     | NO   |     | NULL    |       |
// | total_length     | int(10)      | NO   |     | NULL    |       |
// | hit_length       | int(10)      | NO   |     | NULL    |       |
// | version          | varchar(150) | NO   |     | NULL    |       |
// | artist           | varchar(150) | NO   |     | NULL    |       |
// | title            | varchar(150) | NO   |     | NULL    |       |
// | creator          | varchar(150) | NO   |     | NULL    |       |
// | bpm              | int(10)      | NO   |     | NULL    |       |
// | source           | varchar(150) | NO   |     | NULL    |       |
// | difficultyrating | double       | NO   |     | NULL    |       |
// | diff_size        | int(10)      | NO   |     | NULL    |       |
// | diff_overall     | int(10)      | NO   |     | NULL    |       |
// | diff_approach    | int(10)      | NO   |     | NULL    |       |
// | diff_drain       | int(10)      | NO   |     | NULL    |       |
// | mode             | int(10)      | NO   |     | NULL    |       |
// +------------------+--------------+------+-----+---------+-------+

#[derive(Debug)]
struct BeatmapMetadata {
  // id: i32,
  beatmapset_id: i32,
  beatmap_id: i32,
  // approved: i32,
  approved_date: Option<DateTime<Utc>>,
  // last_update: String,
  total_length: i32,
  // hit_length: i32,
  version: String,
  // artist: String,
  title: String,
  creator: String,
  bpm: i32,
  // source: String,
  difficultyrating: f64,
  diff_size: i32,
  diff_overall: i32,
  diff_approach: i32,
  // diff_drain: i32,
  // mode: i32,
}

fn read_beatmap_metadata() -> FxHashMap<i32, BeatmapMetadata> {
  let beatmap_metadata_fname = Path::new("../../data/beatmaps.parquet");
  let beatmap_metadata_file =
    std::fs::File::open(beatmap_metadata_fname).expect("Failed to open beatmap metadata file");
  let beatmap_metadata_reader = SerializedFileReader::new(beatmap_metadata_file).unwrap();
  let parquet_metadata = beatmap_metadata_reader.metadata();
  assert_eq!(parquet_metadata.num_row_groups(), 1);
  let beatmap_metadata_row_group = beatmap_metadata_reader.get_row_group(0).unwrap();
  // let schema = parquet_metadata.file_metadata().schema_descr();
  // dbg!(schema);

  let mut beatmap_metadata_by_id = FxHashMap::default();
  for row_res in beatmap_metadata_row_group.get_row_iter(None).unwrap() {
    let row = row_res.unwrap();
    // skip the first column which is the id
    let beatmapset_id = row.get_long(1).unwrap();
    let beatmap_id = row.get_long(2).unwrap();
    let approved_date_ts_nanos = row.get_long(4).unwrap_or(0);
    let approved_date = if approved_date_ts_nanos == 0 {
      None
    } else {
      Some(chrono::DateTime::from_timestamp(approved_date_ts_nanos / 1_000_000_000, 0).unwrap())
    };
    let total_length = row.get_long(6).unwrap();
    let version = row.get_string(8).unwrap().clone();
    let title = row.get_string(10).unwrap().clone();
    let creator = row.get_string(11).unwrap().clone();
    let bpm = row.get_long(12).unwrap();
    let difficultyrating = row.get_double(14).unwrap();
    let diff_size = row.get_long(15).unwrap();
    let diff_overall = row.get_long(16).unwrap();
    let diff_approach = row.get_long(17).unwrap();

    let beatmap_metadata = BeatmapMetadata {
      beatmapset_id: beatmapset_id.try_into().unwrap(),
      beatmap_id: beatmap_id.try_into().unwrap(),
      approved_date,
      total_length: total_length.try_into().unwrap(),
      version,
      title,
      creator,
      bpm: bpm.try_into().unwrap(),
      difficultyrating: difficultyrating.try_into().unwrap(),
      diff_size: diff_size.try_into().unwrap(),
      diff_overall: diff_overall.try_into().unwrap(),
      diff_approach: diff_approach.try_into().unwrap(),
    };

    beatmap_metadata_by_id.insert(beatmap_id.try_into().unwrap(), beatmap_metadata);
  }

  beatmap_metadata_by_id
}

pub(crate) async fn build_corpus(score_metadata: Vec<ScoreMetadata>) -> Vec<u8> {
  let score_metadata_by_id: FxHashMap<String, ScoreMetadata> = score_metadata
    .into_iter()
    .map(|sm| (sm.score_id.clone(), sm))
    .collect();

  let beatmap_metadata_by_id = tokio::task::block_in_place(|| read_beatmap_metadata());

  let embedding_file = tokio::fs::read("../../data/embedding_new.json")
    .await
    .expect("Failed to read embedding file");
  // Embedding is in format score_id -> [x, y]
  let embedding: FxHashMap<String, [f32; 2]> =
    serde_json::from_slice(&embedding_file).expect("Failed to parse embedding file");

  let mut strings_buffer = String::new();
  let mut corpus_buffer = Vec::new();

  let num_items = embedding.len() as u32;
  corpus_buffer.extend_from_slice(&num_items.to_le_bytes());

  let difficulties: Vec<DifficultyRecord> = crate::load_difficulties().await;
  let mut difficulties_by_score_id: FxHashMap<String, DifficultyRecord> = difficulties
    .into_iter()
    .map(|dr| (dr.score_id.clone(), dr))
    .collect();

  for (score_id, embedding) in embedding {
    let score_metadata = score_metadata_by_id
      .get(&score_id)
      .expect("Failed to find score metadata");

    let (beatmap_id, mods_str) = score_metadata.score_id.split_once('_').unwrap();
    let beatmap_id: i32 = beatmap_id.parse().unwrap();
    let mods = GameMods::from_str(mods_str).unwrap();
    let mods_bits = mods.bits();

    let beatmap_metadata = beatmap_metadata_by_id
      .get(&beatmap_id)
      .expect("Failed to find beatmap metadata");
    let release_year: u16 = beatmap_metadata
      .approved_date
      .map(|dt| dt.year() as u16)
      .unwrap_or(0);

    // TODO: Temp until all difficulties are computed
    if !difficulties_by_score_id.contains_key(&score_id) {
      let nil_difficulty_record = DifficultyRecord {
        difficulty_aim: 0.,
        difficulty_speed: 0.,
        difficulty_flashlight: 0.,
        speed_note_count: 0.,
        slider_factor: 0.,
        score_id: score_id.clone(),
        stars: 0.,
      };
      difficulties_by_score_id.insert(score_id.clone(), nil_difficulty_record);
    }

    let difficulties = difficulties_by_score_id
      .get(&score_id)
      .unwrap_or_else(|| panic!("Failed to find difficulty record for score {score_id}"));

    corpus_buffer.extend_from_slice(&beatmap_id.to_le_bytes());
    corpus_buffer.extend_from_slice(&mods_bits.to_le_bytes());
    corpus_buffer.extend_from_slice(&embedding[0].to_le_bytes());
    corpus_buffer.extend_from_slice(&embedding[1].to_le_bytes());
    corpus_buffer.extend_from_slice(&(score_metadata.avg_pp as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(difficulties.stars as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.title.len() as u16).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.version.len() as u16).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.creator.len() as u16).to_le_bytes());
    corpus_buffer.extend_from_slice(&release_year.to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.total_length as u16).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.bpm as u16).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.diff_approach as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.diff_size as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.diff_overall as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(difficulties.difficulty_aim as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(difficulties.difficulty_speed as f32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(beatmap_metadata.beatmapset_id as u32).to_le_bytes());
    corpus_buffer.extend_from_slice(&(score_metadata.num_users as u16).to_le_bytes());

    strings_buffer.push_str(&beatmap_metadata.title);
    strings_buffer.push_str(&beatmap_metadata.version);
    strings_buffer.push_str(&beatmap_metadata.creator);
  }

  corpus_buffer.extend_from_slice(strings_buffer.as_bytes());

  info!("Built corpus with {} items", num_items);
  corpus_buffer
}
