require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { verifyToken, requireAdmin } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ service: "admin", status: "ok" });
});

function sendServerError(res, error) {
  console.error("Admin service error:", error.code || error.name || "Error");
  res.status(500).json({ error: "Internal server error" });
}

app.use("/api/v1", verifyToken, requireAdmin);

// HOTELS
app.get("/api/v1/hotels", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  try {
    const result = await pool.query("SELECT * FROM hotels ORDER BY id LIMIT $1 OFFSET $2", [limit, offset]);
    const count = await pool.query("SELECT COUNT(*) FROM hotels");
    res.json({ data: result.rows, page, limit, total: parseInt(count.rows[0].count) });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.post("/api/v1/hotels", async (req, res) => {
  const { name, city, country, address, lat, lng, description, rating, amenities } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO hotels (name, city, country, address, lat, lng, description, rating, amenities) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [name, city, country, address, lat, lng, description, rating || 0, amenities || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.put("/api/v1/hotels/:id", async (req, res) => {
  const { id } = req.params;
  const { name, city, country, address, lat, lng, description, rating, amenities } = req.body;
  try {
    const result = await pool.query(
      "UPDATE hotels SET name=$1, city=$2, country=$3, address=$4, lat=$5, lng=$6, description=$7, rating=$8, amenities=$9 WHERE id=$10 RETURNING *",
      [name, city, country, address, lat, lng, description, rating, amenities, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Hotel not found" });
    res.json(result.rows[0]);
  } catch (e) {
    sendServerError(res, e);
  }
});

// ROOMS
app.get("/api/v1/rooms", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const hotelId = req.query.hotel_id;
  try {
    let query = "SELECT r.*, h.name as hotel_name FROM rooms r JOIN hotels h ON r.hotel_id=h.id";
    let countQuery = "SELECT COUNT(*) FROM rooms r";
    let params = [];
    if (hotelId) {
      query += " WHERE r.hotel_id=$1";
      countQuery += " WHERE r.hotel_id=$1";
      params.push(hotelId);
    }
    query += ` ORDER BY r.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    const count = await pool.query(countQuery, hotelId ? [hotelId] : []);
    res.json({ data: result.rows, page, limit, total: parseInt(count.rows[0].count) });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.post("/api/v1/rooms", async (req, res) => {
  const { hotel_id, room_type, capacity, price_per_night, total_count } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO rooms (hotel_id, room_type, capacity, price_per_night, total_count) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [hotel_id, room_type, capacity, price_per_night, total_count || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    sendServerError(res, e);
  }
});

app.put("/api/v1/rooms/:id", async (req, res) => {
  const { id } = req.params;
  const { room_type, capacity, price_per_night, total_count } = req.body;
  try {
    const result = await pool.query(
      "UPDATE rooms SET room_type=$1, capacity=$2, price_per_night=$3, total_count=$4 WHERE id=$5 RETURNING *",
      [room_type, capacity, price_per_night, total_count, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Room not found" });
    res.json(result.rows[0]);
  } catch (e) {
    sendServerError(res, e);
  }
});

// AVAILABILITY
app.put("/api/v1/rooms/:id/availability", async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date, is_available } = req.body;
  try {
    const room = await pool.query("SELECT total_count FROM rooms WHERE id=$1", [id]);
    if (room.rows.length === 0) return res.status(404).json({ error: "Room not found" });
    const availableCount = is_available ? room.rows[0].total_count : 0;
    await pool.query(
      "INSERT INTO room_availability (room_id, date, available_count) SELECT $1, d::date, $2 FROM generate_series($3::date, $4::date, INTERVAL '1 day') d ON CONFLICT (room_id, date) DO UPDATE SET available_count = EXCLUDED.available_count",
      [id, availableCount, start_date, end_date]
    );
    res.json({ message: "Availability updated", room_id: id, start_date, end_date, is_available });
  } catch (e) {
    sendServerError(res, e);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("Admin service running on port " + PORT);
});
