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
use serde::{Deserialize, Serialize};
use sqlx::{MySql, QueryBuilder};

mod build_corpus;

lazy_static! {
  static ref DB_HOST: String = std::env::var("DB_HOST").expect("DB_HOST must be set");
  static ref DB_USER: String = std::env::var("DB_USER").expect("DB_USER must be set");
  static ref DB_PASSWORD: String = std::env::var("DB_PASSWORD").expect("DB_PASSWORD must be set");
  static ref DB_DATABASE: String = std::env::var("DB_DATABASE").expect("DB_DATABASE must be set");
  static ref DIFFCALC_URL: String = std::env::var("DIFFCALC_URL")
    .unwrap_or_else(|_| "http://127.0.0.1:4512".to_owned())
    .trim_end_matches('/')
    .to_owned();
  static ref DIFFCALC_API_KEY: String =
    std::env::var("DIFFCALC_API_KEY").expect("DIFFCALC_API_KEY must be set");
  static ref HTTP_CLIENT: reqwest::Client = reqwest::Client::builder()
    .connect_timeout(Duration::from_secs(3))
    .timeout(Duration::from_secs(60))
    .build()
    .expect("Failed to build HTTP client");
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

fn filter_score_metadata(
  score_metadata: Vec<ScoreMetadata>,
  score_ids_path: &str,
) -> Vec<ScoreMetadata> {
  let mut reader = csv::Reader::from_path(score_ids_path).unwrap();
  let selected_ids: FxHashSet<String> = reader
    .records()
    .map(|record| record.unwrap()[0].to_owned())
    .collect();
  let selected_count = selected_ids.len();
  let filtered = score_metadata
    .into_iter()
    .filter(|metadata| selected_ids.contains(&metadata.score_id))
    .collect::<Vec<_>>();
  assert_eq!(
    filtered.len(),
    selected_count,
    "Some selected score IDs were missing from score metadata"
  );
  filtered
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
    "INSERT INTO fetched_beatmaps (beatmap_id, raw_beatmap_gzipped) VALUES (?, ?) ON DUPLICATE \
     KEY UPDATE raw_beatmap_gzipped = VALUES(raw_beatmap_gzipped)",
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
    if !raw_beatmap.starts_with(b"osu file format v") {
      return Err(format!(
        "Beatmap {beatmap_id} returned invalid content ({} bytes)",
        raw_beatmap.len()
      ));
    }
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

  download_beatmap_ids(beatmap_ids_to_fetch).await;
}

async fn download_all_relevant_beatmaps() {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  let beatmap_ids = sqlx::query_scalar::<_, i32>(
    "SELECT DISTINCT h.beatmap_id FROM hiscore_updates h LEFT JOIN fetched_beatmaps f ON \
     f.beatmap_id = h.beatmap_id WHERE h.mode = 0 AND h.pp >= 75 AND f.beatmap_id IS NULL",
  )
  .fetch_all(pool)
  .await
  .expect("Failed to query relevant missing beatmaps");

  download_beatmap_ids(beatmap_ids).await;
}

async fn refresh_empty_beatmaps() {
  let pool = DB_POOL.get().expect("DB pool not initialized");
  // A gzip stream containing no bytes is 20 bytes long. These rows were created
  // when osu!'s legacy map endpoint returned HTTP 200 with an empty response.
  let beatmap_ids = sqlx::query_scalar::<_, i32>(
    "SELECT beatmap_id FROM fetched_beatmaps WHERE OCTET_LENGTH(raw_beatmap_gzipped) <= 20",
  )
  .fetch_all(pool)
  .await
  .expect("Failed to query empty cached beatmaps");

  info!("Refreshing {} empty cached beatmaps", beatmap_ids.len());
  download_beatmap_ids(beatmap_ids).await;
}

async fn download_beatmap_ids(beatmap_ids_to_fetch: Vec<i32>) {
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

const DIFFCALC_BATCH_SIZE: usize = 256;

#[derive(Serialize)]
struct DiffcalcBatchRequest {
  calculations: Vec<DiffcalcCalculationRequest>,
}

#[derive(Serialize)]
struct DiffcalcCalculationRequest {
  request_id: String,
  beatmap_id: i32,
  mods: Vec<DiffcalcMod>,
  // The historical embedding corpus is overwhelmingly stable scores and its
  // normalized score identity does not retain CL separately.
  is_classic: bool,
}

#[derive(Serialize)]
struct DiffcalcMod {
  acronym: String,
}

#[derive(Deserialize)]
struct DiffcalcBatchResponse {
  algorithm: DiffcalcAlgorithm,
  results: Vec<DiffcalcCalculationResult>,
}

#[derive(Deserialize)]
struct DiffcalcAlgorithm {
  osu_game_package_version: String,
  difficulty_version: i32,
}

#[derive(Deserialize)]
struct DiffcalcCalculationResult {
  request_id: Option<String>,
  difficulty: Option<DiffcalcDifficulty>,
  error: Option<DiffcalcError>,
}

#[derive(Debug, Deserialize)]
struct DiffcalcDifficulty {
  stars: f64,
  aim: f64,
  speed: f64,
  flashlight: f64,
  speed_note_count: f64,
  slider_factor: f64,
}

#[derive(Deserialize)]
struct DiffcalcError {
  code: String,
  message: String,
}

fn build_diffcalc_request(score_id: &str) -> Result<DiffcalcCalculationRequest, String> {
  let (beatmap_id, mods_string) = score_id
    .split_once('_')
    .ok_or_else(|| format!("Invalid score ID: {score_id}"))?;
  if mods_string.len() % 2 != 0 || !mods_string.is_ascii() {
    return Err(format!("Invalid mod string in score ID: {score_id}"));
  }
  let mods = mods_string
    .as_bytes()
    .chunks_exact(2)
    .map(|chunk| DiffcalcMod {
      acronym: std::str::from_utf8(chunk)
        .expect("validated ASCII")
        .to_owned(),
    })
    .collect();

  Ok(DiffcalcCalculationRequest {
    request_id: score_id.to_owned(),
    beatmap_id: beatmap_id
      .parse()
      .map_err(|err| format!("Invalid beatmap ID in {score_id}: {err}"))?,
    mods,
    is_classic: true,
  })
}

async fn request_difficulties(score_ids: &[String]) -> Result<DiffcalcBatchResponse, String> {
  let calculations = score_ids
    .iter()
    .map(|score_id| build_diffcalc_request(score_id))
    .collect::<Result<Vec<_>, _>>()?;
  let response = HTTP_CLIENT
    .post(format!("{}/v1/calculate", *DIFFCALC_URL))
    .header("X-Diffcalc-Key", DIFFCALC_API_KEY.as_str())
    .json(&DiffcalcBatchRequest { calculations })
    .send()
    .await
    .map_err(|err| format!("Diffcalc request failed: {err}"))?;
  let status = response.status();
  if !status.is_success() {
    let body = response.text().await.unwrap_or_default();
    return Err(format!(
      "Diffcalc returned {status}: {}",
      body.chars().take(512).collect::<String>()
    ));
  }
  response
    .json()
    .await
    .map_err(|err| format!("Failed to decode diffcalc response: {err}"))
}

async fn store_difficulties(difficulties: &[(String, DiffcalcDifficulty)]) -> Result<(), String> {
  if difficulties.is_empty() {
    return Ok(());
  }

  let pool = DB_POOL.get().expect("DB pool not initialized");
  let mut query = QueryBuilder::<MySql>::new(
    "INSERT INTO beatmap_difficulties (score_id, difficulty_aim, difficulty_speed, \
     difficulty_flashlight, speed_note_count, slider_factor, stars) ",
  );
  query.push_values(difficulties, |mut row, (score_id, difficulty)| {
    row
      .push_bind(score_id)
      .push_bind(difficulty.aim)
      .push_bind(difficulty.speed)
      .push_bind(difficulty.flashlight)
      .push_bind(difficulty.speed_note_count)
      .push_bind(difficulty.slider_factor)
      .push_bind(difficulty.stars);
  });
  query.push(
    " ON DUPLICATE KEY UPDATE difficulty_aim = VALUES(difficulty_aim), difficulty_speed = \
     VALUES(difficulty_speed), difficulty_flashlight = VALUES(difficulty_flashlight), \
     speed_note_count = VALUES(speed_note_count), slider_factor = VALUES(slider_factor), stars = \
     VALUES(stars)",
  );

  query
    .build()
    .execute(pool)
    .await
    .map_err(|err| {
      error!(
        "Failed to store batch of {} difficulties: {err}",
        difficulties.len()
      );
      format!(
        "Failed to store batch of {} difficulties: {err}",
        difficulties.len()
      )
    })
    .map(drop)
}

async fn compute_difficulty(score_id: &str) -> Result<DiffcalcDifficulty, String> {
  let mut response = request_difficulties(&[score_id.to_owned()]).await?;
  let result = response
    .results
    .pop()
    .ok_or_else(|| "Diffcalc returned no result".to_owned())?;
  if let Some(error) = result.error {
    return Err(format!("{}: {}", error.code, error.message));
  }
  result
    .difficulty
    .ok_or_else(|| "Diffcalc omitted difficulty attributes".to_owned())
}

async fn compute_all_difficulties(score_metadata: Vec<ScoreMetadata>) {
  let all_score_ids: FxHashSet<String> = score_metadata
    .iter()
    .map(|metadata| metadata.score_id.clone())
    .collect();
  let mut score_ids = all_score_ids.into_iter().collect::<Vec<_>>();
  score_ids.sort_unstable();

  info!(
    "Recomputing canonical difficulties for {} score identities",
    score_ids.len()
  );

  let mut success_count = 0usize;
  let mut failure_count = 0usize;
  let mut failed_score_ids = Vec::new();

  let mut algorithm: Option<(String, i32)> = None;
  for batch in score_ids.chunks(DIFFCALC_BATCH_SIZE) {
    let response = match request_difficulties(batch).await {
      Ok(response) => response,
      Err(err) => {
        error!("{err}");
        failure_count += batch.len();
        failed_score_ids.extend(batch.iter().cloned());
        continue;
      },
    };
    algorithm.get_or_insert((
      response.algorithm.osu_game_package_version,
      response.algorithm.difficulty_version,
    ));
    if response.results.len() != batch.len() {
      error!(
        "Diffcalc returned {} results for a batch of {}",
        response.results.len(),
        batch.len()
      );
      failure_count += batch.len();
      failed_score_ids.extend(batch.iter().cloned());
      continue;
    }

    let mut completed = Vec::with_capacity(batch.len());
    for result in response.results {
      let Some(score_id) = result.request_id else {
        error!("Diffcalc omitted the request ID from a result");
        failure_count += 1;
        failed_score_ids.push("unknown".to_owned());
        continue;
      };
      let Some(difficulty) = result.difficulty else {
        if let Some(error) = result.error {
          error!(
            "Diffcalc failed for {score_id}: {}: {}",
            error.code, error.message
          );
        } else {
          error!("Diffcalc omitted difficulty for {score_id}");
        }
        failure_count += 1;
        failed_score_ids.push(score_id);
        continue;
      };
      completed.push((score_id, difficulty));
    }

    match store_difficulties(&completed).await {
      Ok(_) => success_count += completed.len(),
      Err(err) => {
        error!("{err}");
        failure_count += completed.len();
        failed_score_ids.extend(completed.into_iter().map(|(score_id, _)| score_id));
      },
    }
    info!("Stored {success_count} canonical difficulties so far");
  }

  if let Some((package, version)) = algorithm {
    info!("Canonical algorithm: ppy.osu.Game {package}, difficulty version {version}");
  }
  let failures_filename = "../../data/difficulty_failures.csv";
  let mut failures_writer = csv::Writer::from_path(failures_filename)
    .expect("Failed to create difficulty failure manifest");
  failures_writer
    .write_record(["score_id"])
    .expect("Failed to write difficulty failure manifest header");
  for score_id in &failed_score_ids {
    failures_writer
      .write_record([score_id])
      .expect("Failed to write difficulty failure manifest row");
  }
  failures_writer
    .flush()
    .expect("Failed to flush difficulty failure manifest");
  info!(
    "Wrote {} failures to {failures_filename}",
    failed_score_ids.len()
  );
  info!("Finished computing difficulties: {success_count} successes, {failure_count} failures");
  assert_eq!(
    failure_count, 0,
    "Canonical difficulty refresh was incomplete; refusing to continue with missing results"
  );
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
  /// Prefetch every uncached map used by a mode=osu, pp>=75 history row directly from the DB.
  #[clap(name = "download-relevant")]
  DownloadAllRelevantBeatmaps,
  /// Replace cached gzip streams which contain an empty beatmap response.
  #[clap(name = "refresh-empty")]
  RefreshEmptyBeatmaps,
  #[clap(name = "compute-all")]
  ComputeAllDifficulties,
  /// Recompute only score identities retained by the final embedding.
  #[clap(name = "compute-embedding")]
  ComputeEmbeddingDifficulties,
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

  init_db_pool().await;

  match cli.command {
    Command::DownloadAllBeatmaps =>
      download_all_beatmaps(parse_score_metadata("../../data/score_metadata.csv")).await,
    Command::DownloadAllRelevantBeatmaps => download_all_relevant_beatmaps().await,
    Command::RefreshEmptyBeatmaps => refresh_empty_beatmaps().await,
    Command::ComputeAllDifficulties =>
      compute_all_difficulties(parse_score_metadata("../../data/score_metadata.csv")).await,
    Command::ComputeEmbeddingDifficulties => {
      let score_metadata = parse_score_metadata("../../data/score_metadata.csv");
      let selected = filter_score_metadata(score_metadata, "../../data/score_id_mapping.csv");
      compute_all_difficulties(selected).await;
    },
    Command::Compute { score_id } => {
      let difficulty = compute_difficulty(&score_id).await.unwrap();
      println!("{difficulty:?}");
    },
    Command::DumpDifficulties => dump_difficulties().await,
    Command::BuildCorpus => {
      let corpus =
        build_corpus::build_corpus(parse_score_metadata("../../data/score_metadata.csv")).await;
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
