const amqp = require("amqplib");

async function withReservationChannel(handler) {
  if (!process.env.AMQP_URL) {
    throw new Error("AMQP_URL is required");
  }

  const connection = await amqp.connect(process.env.AMQP_URL);
  try {
    const channel = await connection.createChannel();
    await channel.assertQueue("reservations", { durable: true });
    try {
      return await handler(channel);
    } finally {
      await channel.close();
    }
  } finally {
    await connection.close();
  }
}

module.exports = { withReservationChannel };
