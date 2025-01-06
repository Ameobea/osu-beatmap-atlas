extern crate foundations;

use std::{
  io::{Read, Write},
  time::Duration,
};

use clap::{Parser, Subcommand};
use fxhash::FxHashSet;
use lazy_static::lazy_static;
use once_cell::sync::OnceCell;

use foundations::telemetry::{log::*, settings::LogVerbosity, TelemetryConfig};
use rosu_mods::GameMode;
use rosu_pp::{any::DifficultyAttributes, osu::OsuDifficultyAttributes, Beatmap, Difficulty};
use rosu_v2::prelude::{GameMod, GameMods};

mod build_corpus;

lazy_static! {
  static ref DB_HOST: String = std::env::var("DB_HOST").expect("DB_HOST must be set");
  static ref DB_USER: String = std::env::var("DB_USER").expect("DB_USER must be set");
  static ref DB_PASSWORD: String = std::env::var("DB_PASSWORD").expect("DB_PASSWORD must be set");
  static ref DB_DATABASE: String = std::env::var("DB_DATABASE").expect("DB_DATABASE must be set");
}

static DB_POOL: OnceCell<sqlx::MySqlPool> = OnceCell::new();

const FETCH_INTERVAL: Duration = Duration::from_millis(1200);

async fn init_db_pool() {
  let db_url = format!(
    "mysql://{}:{}@{}/{}",
    *DB_USER, *DB_PASSWORD, *DB_HOST, *DB_DATABASE
  );
  let pool = sqlx::MySqlPool::connect(&db_url)
    .await
    .expect("Failed to connect to MySQL");
  DB_POOL.set(pool).unwrap();
}

struct ScoreMetadata {
  score_id: String,
  #[allow(dead_code)]
  avg_pp: f64,
  #[allow(dead_code)]
  num_users: i32,
}

fn parse_score_metadata(file_path: &str) -> Vec<ScoreMetadata> {
  let mut rdr = csv::Reader::from_path(file_path).unwrap();
  let mut score_metadata = Vec::new();
  for result in rdr.records() {
    let record = result.unwrap();
    let score_id = record[0].to_string();
    let avg_pp = record[1].parse::<f64>().unwrap();
    let num_users = record[2].parse::<i32>().unwrap();
    score_metadata.push(ScoreMetadata {
      score_id,
      avg_pp,
      num_users,
    });
  }
  score_metadata
}

// fetched_beatmaps:
// +---------------------+----------+------+-----+---------+-------+
// | Field               | Type     | Null | Key | Default | Extra |
// +---------------------+----------+------+-----+---------+-------+
// | beatmap_id          | int(11)  | NO   | PRI | NULL    |       |
// | raw_beatmap_gzipped | longblob | NO   |     | NULL    |       |
// +---------------------+----------+------+-----+---------+-------+

// beatmap_difficulties:
// +-----------------------+----------+------+-----+---------+-------+
// | Field                 | Type     | Null | Key | Default | Extra |
// +-----------------------+----------+------+-----+---------+-------+
// | score_id              | text     | NO   | PRI | NULL    |       |
// | difficulty_aim        | double   | NO   |     | 0       |       |
// | difficulty_speed      | double   | NO   |     | 0       |       |
// | difficulty_flashlight | double   | NO   |     | 0       |       |
// | speed_note_count      | double   | NO   |     | 0       |       |
// | slider_factor         | double   | NO   |     | 0       |       |
// +-----------------------+----------+------+-----+---------+-------+
//
// UP:
// CREATE TABLE fetched_beatmaps (
//     beatmap_id INT PRIMARY KEY,
//     raw_beatmap_gzipped LONGBLOB NOT NULL
// );
//
// CREATE TABLE beatmap_difficulties (
//     score_id TEXT PRIMARY KEY,
//     difficulty_aim DOUBLE NOT NULL DEFAULT 0,
//     difficulty_speed DOUBLE NOT NULL DEFAULT 0,
//     difficulty_flashlight DOUBLE NOT NULL DEFAULT 0,
//     speed_note_count DOUBLE NOT NULL DEFAULT 0,
//     slider_factor DOUBLE NOT NULL DEFAULT 0
// );

async fn compress_and_insert_beatmap(beatmap_id: i32, raw_beatmap: &[u8]) -> Result<(), String> {
  let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());

  encoder
    .write_all(raw_beatmap)
    .expect("Failed to write to encoder");
  let raw_beatmap_gzipped = encoder.finish().expect("Failed to finish encoder");

  let pool = DB_POOL.get().expect("DB pool not initialized");
  sqlx::query!(
    "INSERT INTO fetched_beatmaps (beatmap_id, raw_beatmap_gzipped) VALUES (?, ?)",
    beatmap_id,
    raw_beatmap_gzipped
  )
  .execute(pool)
  .await
  .map_err(|err| {
    error!("Failed to insert beatmap {beatmap_id}: {err}");
    format!("Failed to insert beatmap {beatmap_id}: {err}")
  })?;

  Ok(())
}

async fn fetch_beatmap(beatmap_id: i32) -> Result<Vec<u8>, String> {
  tokio::time::sleep(FETCH_INTERVAL).await;

  let url = format!("https://osu.ppy.sh/osu/{beatmap_id}");
  let resp = reqwest::get(&url).await.map_err(|e| {
    error!("Error fetching beatmap {}: {}", beatmap_id, e);
    format!("Failed to fetch beatmap {}: {}", beatmap_id, e)
  })?;

  if resp.status().is_success() {
    let raw_beatmap = resp.bytes().await.unwrap();
    Ok(raw_beatmap.to_vec())
  } else {
    let status = resp.status();
    let body = resp
      .text()
      .await
      .unwrap_or_else(|_| "Failed to fetch body".to_string());
    error!("Failed to fetch beatmap {beatmap_id}: {status} {body}");
    Err(format!(
      "Failed to fetch beatmap {beatmap_id}: {status} {body}"
    ))
  }
}

async fn get_beatmap_ids_to_fetch(all_beatmap_ids: &FxHashSet<i32>) -> Vec<i32> {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  let beatmap_ids: Vec<i32> = sqlx::query_scalar("SELECT beatmap_id FROM fetched_beatmaps")
    .fetch_all(pool)
    .await
    .expect("Failed to fetch beatmap IDs");

  let beatmap_ids_set: FxHashSet<i32> = beatmap_ids.into_iter().collect();
  let beatmaps_ids_to_fetch: Vec<i32> = all_beatmap_ids
    .difference(&beatmap_ids_set)
    .copied()
    .collect();
  beatmaps_ids_to_fetch
}

async fn download_and_save_beatmap(beatmap_id: i32) -> Result<(), String> {
  let raw_beatmap = fetch_beatmap(beatmap_id).await?;
  compress_and_insert_beatmap(beatmap_id, &raw_beatmap).await
}

async fn download_all_beatmaps(score_metadata: Vec<ScoreMetadata>) {
  let all_beatmap_ids = score_metadata
        .iter()
        // score IDs are like "{beatmap_id}_{mods}"
        .map(|metadata| {
            metadata
                .score_id
                .split('_')
                .next()
                .unwrap()
                .parse::<i32>()
                .unwrap()
        })
        .collect();

  let beatmap_ids_to_fetch = get_beatmap_ids_to_fetch(&all_beatmap_ids).await;

  info!("Need to fetch {} beatmaps", beatmap_ids_to_fetch.len());

  let mut success_count = 0usize;
  let mut failure_count = 0usize;

  for beatmap_id in beatmap_ids_to_fetch {
    if let Err(err) = download_and_save_beatmap(beatmap_id).await {
      error!("{err}");
      failure_count += 1;
      continue;
    }

    info!("Fetched and stored beatmap {beatmap_id}");
    success_count += 1;
  }

  info!("Finished fetching beatmaps: {success_count} successes, {failure_count} failures");
}

async fn load_beatmap(beatmap_id: i32) -> Result<Option<Vec<u8>>, String> {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  let raw_beatmap_gzipped: Option<Vec<u8>> =
    sqlx::query_scalar("SELECT raw_beatmap_gzipped FROM fetched_beatmaps WHERE beatmap_id = ?")
      .bind(beatmap_id)
      .fetch_optional(pool)
      .await
      .map_err(|err| {
        error!("Failed to fetch beatmap {beatmap_id}: {err}");
        format!("Failed to fetch beatmap {beatmap_id}: {err}")
      })?;
  let Some(raw_beatmap_gzipped) = raw_beatmap_gzipped else {
    return Ok(None);
  };

  let mut decoder = flate2::read::GzDecoder::new(&raw_beatmap_gzipped[..]);
  let mut decompressed = Vec::new();
  decoder
    .read_to_end(&mut decompressed)
    .expect("Failed to decompress");

  Ok(Some(decompressed))
}

async fn get_score_ids_needing_difficulty(all_score_ids: &FxHashSet<String>) -> Vec<String> {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  let score_ids: Vec<String> = sqlx::query_scalar("SELECT score_id FROM beatmap_difficulties")
    .fetch_all(pool)
    .await
    .expect("Failed to fetch score IDs");

  let score_ids_set: FxHashSet<String> = score_ids.into_iter().collect();
  let score_ids_needing_difficulty: Vec<String> = all_score_ids
    .difference(&score_ids_set)
    .cloned()
    .collect::<Vec<_>>();
  score_ids_needing_difficulty
}

fn compute_difficulty_inner(
  raw_beatmap: &[u8],
  mods: GameMods,
) -> Result<OsuDifficultyAttributes, String> {
  let calc = Difficulty::new().mods(mods.bits());
  let map = match Beatmap::from_bytes(raw_beatmap) {
    Ok(map) => map,
    Err(err) => {
      error!("Error parsing beatmap: {err}");
      return Err(format!("{err}"));
    },
  };
  let DifficultyAttributes::Osu(diff_attrs) = calc.calculate(&map) else {
    unreachable!("Fond no osu! difficulty attributes");
  };
  Ok(diff_attrs)
}

async fn store_difficulty(
  score_id: &str,
  difficulty: &OsuDifficultyAttributes,
) -> Result<(), String> {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  sqlx::query!(
    "INSERT INTO beatmap_difficulties (score_id, difficulty_aim, difficulty_speed, \
     difficulty_flashlight, speed_note_count, slider_factor, stars) VALUES (?, ?, ?, ?, ?, ?, ?)",
    score_id,
    difficulty.aim,
    difficulty.speed,
    difficulty.flashlight,
    difficulty.speed_note_count,
    difficulty.slider_factor,
    difficulty.stars
  )
  .execute(pool)
  .await
  .map_err(|err| {
    error!("Failed to store difficulty for {score_id}: {err}");
    format!("Failed to store difficulty for {score_id}: {err}")
  })
  .map(drop)
}

async fn compute_difficulty(score_id: &str) -> Result<OsuDifficultyAttributes, String> {
  let (beatmap_id, mods_string) = score_id
    .split_once('_')
    .expect("Failed to split score ID into beatmap ID and mods");
  let mut game_mods = GameMods::new();
  let mod_count = mods_string.len() / 2;
  for i in 0..mod_count {
    let acronym = &mods_string[i * 2..(i + 1) * 2];
    let game_mod = GameMod::new(acronym, GameMode::Osu);
    game_mods.insert(game_mod);
  }

  let raw_beatmap = match load_beatmap(beatmap_id.parse().unwrap()).await {
    Ok(Some(raw_beatmap)) => raw_beatmap,
    Ok(None) => {
      info!("Missing beatmap {beatmap_id}; downloading and storing...");

      let raw_beatmap = match fetch_beatmap(beatmap_id.parse().unwrap()).await {
        Ok(raw_beatmap) => raw_beatmap,
        Err(err) => {
          error!("{err}");
          return Err(err);
        },
      };

      let _ = compress_and_insert_beatmap(beatmap_id.parse().unwrap(), &raw_beatmap).await;

      raw_beatmap
    },
    Err(err) => {
      error!("{err}");
      return Err(err);
    },
  };

  let difficulty = compute_difficulty_inner(&raw_beatmap, game_mods).unwrap();
  Ok(difficulty)
}

async fn compute_all_difficulties(score_metadata: Vec<ScoreMetadata>) {
  let all_score_ids: FxHashSet<String> = score_metadata
    .iter()
    .map(|metadata| metadata.score_id.clone())
    .collect();
  let score_ids_needing_difficulty = get_score_ids_needing_difficulty(&all_score_ids).await;

  info!(
    "Need to compute difficulties for {} scores",
    score_ids_needing_difficulty.len()
  );

  let mut success_count = 0usize;
  let mut failure_count = 0usize;

  for score_id in score_ids_needing_difficulty {
    let difficulty = match compute_difficulty(&score_id).await {
      Ok(difficulty) => difficulty,
      Err(err) => {
        error!("{err}");
        failure_count += 1;
        continue;
      },
    };

    match store_difficulty(&score_id, &difficulty).await {
      Ok(_) => {
        success_count += 1;
        info!("Stored difficulty for {score_id}");
      },
      Err(err) => {
        error!("{err}");
        failure_count += 1;
      },
    }
  }

  info!("Finished computing difficulties: {success_count} successes, {failure_count} failures");
}

struct DifficultyRecord {
  score_id: String,
  difficulty_aim: f64,
  difficulty_speed: f64,
  difficulty_flashlight: f64,
  speed_note_count: f64,
  slider_factor: f64,
  stars: f64,
}

async fn load_difficulties() -> Vec<DifficultyRecord> {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  let difficulties: Vec<DifficultyRecord> =
    sqlx::query_as!(DifficultyRecord, "SELECT * FROM beatmap_difficulties")
      .fetch_all(pool)
      .await
      .expect("Failed to fetch difficulties");
  difficulties
}

async fn dump_difficulties() {
  let difficulties = load_difficulties().await;

  let out_filename = "../../data/difficulties.csv";
  let mut wtr = csv::Writer::from_path(out_filename).unwrap();
  wtr
    .write_record(&[
      "score_id",
      "difficulty_aim",
      "difficulty_speed",
      "difficulty_flashlight",
      "speed_note_count",
      "slider_factor",
      "stars",
    ])
    .unwrap();
  for DifficultyRecord {
    score_id,
    difficulty_aim,
    difficulty_speed,
    difficulty_flashlight,
    speed_note_count,
    slider_factor,
    stars,
  } in difficulties
  {
    wtr
      .write_record(&[
        score_id,
        difficulty_aim.to_string(),
        difficulty_speed.to_string(),
        difficulty_flashlight.to_string(),
        speed_note_count.to_string(),
        slider_factor.to_string(),
        stars.to_string(),
      ])
      .unwrap();
  }
  wtr.flush().expect("Failed to flush writer");

  info!("Dumped difficulties to {out_filename}");
}

#[derive(Subcommand)]
enum Command {
  #[clap(name = "download")]
  DownloadAllBeatmaps,
  #[clap(name = "compute-all")]
  ComputeAllDifficulties,
  #[clap(name = "compute")]
  Compute { score_id: String },
  #[clap(name = "dump-difficulties")]
  DumpDifficulties,
  #[clap(name = "build-corpus")]
  BuildCorpus,
}

#[derive(Parser)]
struct Cli {
  #[clap(subcommand)]
  command: Command,
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
  let _ = dotenv::dotenv();

  let svc_info = foundations::service_info!();
  let mut telemetry_settings = foundations::telemetry::settings::TelemetrySettings::default();
  telemetry_settings.logging.verbosity = LogVerbosity::Info;
  foundations::telemetry::init(TelemetryConfig {
    service_info: &svc_info,
    settings: &telemetry_settings,
  })
  .expect("Failed to initialize telemetry");

  let cli = Cli::parse();

  let score_metadata_filename = "../../data/score_metadata.csv";
  let score_metadata = parse_score_metadata(score_metadata_filename);

  init_db_pool().await;

  match cli.command {
    Command::DownloadAllBeatmaps => download_all_beatmaps(score_metadata).await,
    Command::ComputeAllDifficulties => compute_all_difficulties(score_metadata).await,
    Command::Compute { score_id } => {
      let difficulty = compute_difficulty(&score_id).await.unwrap();
      println!("{difficulty:?}");
    },
    Command::DumpDifficulties => dump_difficulties().await,
    Command::BuildCorpus => {
      let corpus = build_corpus::build_corpus(score_metadata).await;
      let out_filename = "../../data/corpus";
      tokio::fs::write(out_filename, corpus)
        .await
        .expect("Failed to write corpus");
    },
  }
}

/// Delete beatmap id 150057 from the DB
///
/// Download beatmap id 150057
///
/// Store in the DB
///
/// Load it from the DB and de-compress it
///
/// Make sure the contents are the same
#[tokio::test]
async fn beatmap_download_sanity() {
  let _ = dotenv::dotenv();

  init_db_pool().await;

  let beatmap_id = 150057;
  sqlx::query!(
    "DELETE FROM fetched_beatmaps WHERE beatmap_id = ?",
    beatmap_id
  )
  .execute(DB_POOL.get().expect("DB pool not initialized"))
  .await
  .expect("Failed to delete beatmap");

  let raw_beatmap = fetch_beatmap(beatmap_id).await.unwrap();
  compress_and_insert_beatmap(beatmap_id, &raw_beatmap)
    .await
    .unwrap();

  let raw_beatmap_from_db = load_beatmap(beatmap_id).await.unwrap().unwrap();

  assert_eq!(raw_beatmap, raw_beatmap_from_db);
}
