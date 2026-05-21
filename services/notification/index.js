require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { withReservationChannel } = require("./queue");

const app = express();
app.use(cors());
app.use(express.json());

function sendServerError(res, error) {
  console.error("Notification service error:", error.code || error.name || "Error");
  res.status(500).json({ error: "Internal server error" });
}

app.get("/health", (req, res) => {
  res.json({ service: "notification", status: "ok" });
});

app.get("/cron/check-capacity", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id AS room_id,
         r.room_type,
         r.total_count,
         h.name AS hotel_name,
         COALESCE(SUM(ra.available_count), 0)::int AS available_total,
         (r.total_count * 30)::int AS capacity_total
       FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id
       LEFT JOIN room_availability ra
         ON ra.room_id = r.id
        AND ra.date >= CURRENT_DATE
        AND ra.date < CURRENT_DATE + INTERVAL '30 days'
       GROUP BY r.id, r.room_type, r.total_count, h.name
       ORDER BY r.id`
    );

    const alerts = [];
    for (const room of result.rows) {
      const threshold = room.capacity_total * 0.2;
      if (room.available_total < threshold) {
        const message = `Admin alert: low capacity for room ${room.room_id} (hotel ${room.hotel_name})`;
        console.log(message);
        alerts.push({
          room_id: room.room_id,
          room_type: room.room_type,
          hotel_name: room.hotel_name,
          available_total: room.available_total,
          capacity_total: room.capacity_total,
          message
        });
      }
    }

    res.json({
      checked_rooms: result.rows.length,
      alerts_count: alerts.length,
      alerts
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.get("/cron/process-reservations", async (req, res) => {
  try {
    const processed = await withReservationChannel(async (channel) => {
      const notifications = [];

      while (true) {
        const msg = await channel.get("reservations", { noAck: false });
        if (!msg) {
          break;
        }

        try {
          const payload = JSON.parse(msg.content.toString());
          const message = `Notification sent to ${payload.user_email}: reservation #${payload.booking_id} confirmed at ${payload.hotel_name}`;
          console.log(message);
          notifications.push({
            booking_id: payload.booking_id,
            user_email: payload.user_email,
            hotel_name: payload.hotel_name,
            message
          });
          channel.ack(msg);
        } catch (e) {
          console.error("Notification service error:", "Invalid reservation message");
          channel.ack(msg);
        }
      }

      return notifications;
    });

    res.json({
      processed_count: processed.length,
      notifications: processed
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log("Notification service running on port " + PORT);
});
