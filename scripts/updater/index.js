require("dotenv").config();
const mysql = require("mysql");
const axios = require("axios");
const { promisify } = require("util");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: "osutrack_migration",
});

const connect = promisify(connection.connect).bind(connection);
const query = promisify(connection.query).bind(connection);

const updateUser = async (userId) => {
  const url = `https://osutrack-api.ameo.dev/update?user=${userId}&mode=0`;
  console.log(`Updating user ${userId}`);
  axios
    .post(url)
    .then((response) =>
      console.log(`Updated user ${userId} with status code: ${response.status}`)
    )
    .catch((error) =>
      console.log(`Error updating user ${userId}: ${error.message}`)
    );

  await query(
    `UPDATE users_to_collect SET last_collected_utc = NOW() WHERE osu_id = ?`,
    [userId]
  );
};

const main = async () => {
  try {
    await connect();
    console.log("Connected to database.");

    const users = await query(
      `SELECT osu_id FROM users_to_collect WHERE last_collected_utc IS NULL`
    );
    const shuffledUsers = users.sort(() => 0.5 - Math.random());

    for (const user of shuffledUsers) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      updateUser(user.osu_id);
    }
  } catch (error) {
    console.error("Failed to execute script:", error);
  } finally {
    connection.end();
  }
};

main();
