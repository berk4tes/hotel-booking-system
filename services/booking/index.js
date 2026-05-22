require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { verifyToken } = require("./auth");
const { publishReservation } = require("./queue");

const app = express();
app.use(cors());
app.use(express.json());

function parsePositiveInt(value, fallback = null) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sendServerError(res, error) {
  console.error("Booking service error:", error.code || error.name || "Error");
  res.status(500).json({ error: "Internal server error" });
}

function normalizeBooking(row) {
  return {
    ...row,
    total_price: parseFloat(row.total_price)
  };
}

app.get("/health", (req, res) => {
  res.json({ service: "booking", status: "ok" });
});

app.use("/api/v1", verifyToken);

app.post("/api/v1/bookings", async (req, res) => {
  const roomId = parsePositiveInt(req.body.room_id);
  const guests = parsePositiveInt(req.body.guests);
  const { start_date, end_date } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: "room_id is required" });
  }

  if (!guests) {
    return res.status(400).json({ error: "guests is required" });
  }

  if (!isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: "start_date and end_date must be YYYY-MM-DD" });
  }

  if (start_date > end_date) {
    return res.status(400).json({ error: "start_date must be before or equal to end_date" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const roomResult = await client.query(
      `SELECT
         r.id,
         r.room_type,
         r.capacity,
         r.price_per_night,
         h.name AS hotel_name
       FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id
       WHERE r.id=$1`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Room not found" });
    }

    const room = roomResult.rows[0];
    if (guests > room.capacity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "guests exceeds room capacity" });
    }

    const dateCountResult = await client.query(
      "SELECT COUNT(*)::int AS total FROM generate_series($1::date, $2::date, INTERVAL '1 day') d",
      [start_date, end_date]
    );
    const dateCount = dateCountResult.rows[0].total;

    const availabilityResult = await client.query(
      `SELECT date, available_count
       FROM room_availability
       WHERE room_id=$1 AND date BETWEEN $2::date AND $3::date
       ORDER BY date
       FOR UPDATE`,
      [roomId, start_date, end_date]
    );

    if (availabilityResult.rows.length !== dateCount || availabilityResult.rows.some((row) => row.available_count < 1)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Room is not available for the selected dates" });
    }

    const updateResult = await client.query(
      `UPDATE room_availability
       SET available_count = available_count - 1
       WHERE room_id=$1
         AND date BETWEEN $2::date AND $3::date
         AND available_count > 0
       RETURNING id`,
      [roomId, start_date, end_date]
    );

    if (updateResult.rows.length !== dateCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Room is not available for the selected dates" });
    }

    const totalPrice = parseFloat((parseFloat(room.price_per_night) * dateCount).toFixed(2));
    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, user_email, room_id, start_date, end_date, guests, total_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.user.sub, req.user.email, roomId, start_date, end_date, guests, totalPrice]
    );

    await client.query("COMMIT");
    const booking = bookingResult.rows[0];
    let notificationQueued = true;

    try {
      await publishReservation({
        booking_id: booking.id,
        user_email: booking.user_email,
        hotel_name: room.hotel_name,
        room_type: room.room_type,
        start_date,
        end_date,
        total_price: totalPrice
      });
    } catch (e) {
      notificationQueued = false;
      console.error("Reservation queue publish failed:", e.code || e.name || "Error");
    }

    res.status(201).json({ ...normalizeBooking(booking), notification_queued: notificationQueued });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    sendServerError(res, e);
  } finally {
    client.release();
  }
});

app.get("/api/v1/bookings/me", async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 10);
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT
         b.*,
         r.room_type,
         h.name AS hotel_name,
         h.city,
         h.country
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN hotels h ON h.id = r.hotel_id
       WHERE b.user_id=$1
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.sub, limit, offset]
    );

    const count = await pool.query("SELECT COUNT(*) FROM bookings WHERE user_id=$1", [req.user.sub]);
    res.json({
      data: result.rows.map(normalizeBooking),
      page,
      limit,
      total: parseInt(count.rows[0].count, 10)
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.delete("/api/v1/bookings/:id", async (req, res) => {
  const bookingId = parsePositiveInt(req.params.id);

  if (!bookingId) {
    return res.status(400).json({ error: "booking id is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT id, room_id, start_date, end_date
       FROM bookings
       WHERE id=$1 AND user_id=$2
       FOR UPDATE`,
      [bookingId, req.user.sub]
    );

    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingResult.rows[0];
    await client.query(
      `UPDATE room_availability
       SET available_count = available_count + 1
       WHERE room_id=$1
         AND date BETWEEN $2::date AND $3::date`,
      [booking.room_id, booking.start_date, booking.end_date]
    );

    await client.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
    await client.query("COMMIT");

    res.json({ deleted: true, booking_id: bookingId });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    sendServerError(res, e);
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log("Booking service running on port " + PORT);
});
