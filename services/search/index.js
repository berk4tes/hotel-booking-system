require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { optionalVerifyToken } = require("./auth");
const { getRedisClient } = require("./cache");

const app = express();
app.use(cors());
app.use(express.json());

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function applyDiscountToRoom(room, hasDiscount) {
  const price = parseFloat(room.price_per_night);
  const normalized = {
    ...room,
    price_per_night: price
  };

  if (hasDiscount) {
    normalized.discounted_price = parseFloat((price * 0.85).toFixed(2));
  }

  return normalized;
}

function sendServerError(res, error) {
  console.error("Search service error:", error.code || error.name || "Error");
  res.status(500).json({ error: "Internal server error" });
}

app.get("/health", (req, res) => {
  res.json({ service: "search", status: "ok" });
});

app.get("/api/v1/hotels/search", optionalVerifyToken, async (req, res) => {
  const city = req.query.city;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  const guests = parsePositiveInt(req.query.guests, 1);
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 10);
  const offset = (page - 1) * limit;
  const hasDiscount = Boolean(req.user);

  if (!startDate || !endDate || !isValidDate(startDate) || !isValidDate(endDate)) {
    return res.status(400).json({ error: "start_date and end_date must be YYYY-MM-DD" });
  }

  if (startDate > endDate) {
    return res.status(400).json({ error: "start_date must be before or equal to end_date" });
  }

  try {
    const params = [startDate, endDate, guests];
    let cityFilter = "";
    if (city) {
      params.push(city);
      cityFilter = `AND LOWER(h.city) = LOWER($${params.length})`;
    }

    const baseQuery = `
      WITH requested_dates AS (
        SELECT d::date AS date
        FROM generate_series($1::date, $2::date, INTERVAL '1 day') d
      ),
      date_count AS (
        SELECT COUNT(*)::int AS total FROM requested_dates
      ),
      available_rooms AS (
        SELECT
          h.id AS hotel_id,
          h.name,
          h.city,
          h.country,
          h.address,
          h.lat,
          h.lng,
          h.description,
          h.rating,
          h.amenities,
          r.id AS room_id,
          r.room_type,
          r.capacity,
          r.price_per_night,
          r.total_count
        FROM hotels h
        JOIN rooms r ON r.hotel_id = h.id
        JOIN room_availability ra ON ra.room_id = r.id
        JOIN requested_dates rd ON rd.date = ra.date
        CROSS JOIN date_count dc
        WHERE r.capacity >= $3
          AND ra.available_count >= $3
          ${cityFilter}
        GROUP BY h.id, r.id
        HAVING COUNT(DISTINCT ra.date) = (SELECT total FROM date_count)
           AND MIN(ra.available_count) >= $3
      ),
      hotel_rows AS (
        SELECT
          hotel_id,
          name,
          city,
          country,
          address,
          lat,
          lng,
          description,
          rating,
          amenities,
          MIN(price_per_night) AS min_price_per_night,
          json_agg(
            json_build_object(
              'id', room_id,
              'room_type', room_type,
              'capacity', capacity,
              'price_per_night', price_per_night,
              'total_count', total_count
            )
            ORDER BY price_per_night, room_id
          ) AS rooms
        FROM available_rooms
        GROUP BY hotel_id, name, city, country, address, lat, lng, description, rating, amenities
      )
    `;

    const countResult = await pool.query(`${baseQuery} SELECT COUNT(*) FROM hotel_rows`, params);

    const result = await pool.query(
      `${baseQuery}
       SELECT *
       FROM hotel_rows
       ORDER BY min_price_per_night, hotel_id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const data = result.rows.map((hotel) => {
      const minPrice = parseFloat(hotel.min_price_per_night);
      const rooms = hotel.rooms.map((room) => applyDiscountToRoom(room, hasDiscount));
      const normalized = {
        ...hotel,
        lat: hotel.lat === null ? null : parseFloat(hotel.lat),
        lng: hotel.lng === null ? null : parseFloat(hotel.lng),
        rating: hotel.rating === null ? null : parseFloat(hotel.rating),
        min_price_per_night: minPrice,
        rooms
      };

      if (hasDiscount) {
        normalized.discounted_min_price = parseFloat((minPrice * 0.85).toFixed(2));
      }

      return normalized;
    });

    res.json({
      data,
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10)
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.get("/api/v1/hotels/:id", async (req, res) => {
  const { id } = req.params;
  const cacheKey = `hotel:${id}`;

  try {
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cache: "hit" });
    }

    const hotelResult = await pool.query("SELECT * FROM hotels WHERE id=$1", [id]);
    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    const roomsResult = await pool.query(
      "SELECT id, hotel_id, room_type, capacity, price_per_night, total_count, created_at FROM rooms WHERE hotel_id=$1 ORDER BY price_per_night, id",
      [id]
    );

    const hotel = hotelResult.rows[0];
    const response = {
      ...hotel,
      lat: hotel.lat === null ? null : parseFloat(hotel.lat),
      lng: hotel.lng === null ? null : parseFloat(hotel.lng),
      rating: hotel.rating === null ? null : parseFloat(hotel.rating),
      rooms: roomsResult.rows.map((room) => ({
        ...room,
        price_per_night: parseFloat(room.price_per_night)
      }))
    };

    await redis.set(cacheKey, response, { ex: 300 });
    res.json({ ...response, cache: "miss" });
  } catch (e) {
    sendServerError(res, e);
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log("Search service running on port " + PORT);
});
