require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");

const app = express();
const port = 3920; // You can change the port number

// MySQL connection setup
const pool = mysql.createPool({
  connectionLimit: 10,
  host: "ameo.dev",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: "osutrack_migration",
  port: 3306,
});

// Middleware
app.use(bodyParser.json());

// Endpoint to collect user IDs
app.post("/collect_osu_usernames", (req, res) => {
  const userIds = req.body;
  console.log(userIds);

  // Basic validation
  if (!Array.isArray(userIds) || !userIds.every(Number.isInteger)) {
    return res.status(400).send("Invalid input");
  }

  // Inserting user IDs, ignoring duplicates
  const values = userIds.map((id) => [id]);
  const query = "INSERT IGNORE INTO users_to_collect (osu_id) VALUES ?";

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting MySQL connection", err);
      return res.status(500).send("Server error");
    }

    connection.query(query, [values], (error, results) => {
      connection.release();

      if (error) {
        console.error("Error executing query", error);
        return res.status(500).send("Server error");
      }

      res.send("Data inserted successfully");
    });
  });
});

app.use((req, res, next) => {
  console.log(req.url);
  res.status(404).send("Sorry can't find that!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
