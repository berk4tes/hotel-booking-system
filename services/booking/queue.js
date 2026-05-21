const amqp = require("amqplib");

async function publishReservation(payload) {
  if (!process.env.AMQP_URL) {
    throw new Error("AMQP_URL is required");
  }

  const connection = await amqp.connect(process.env.AMQP_URL);
  try {
    const channel = await connection.createChannel();
    await channel.assertQueue("reservations", { durable: true });
    channel.sendToQueue("reservations", Buffer.from(JSON.stringify(payload)), {
      persistent: true
    });
    await channel.close();
  } finally {
    await connection.close();
  }
}

module.exports = { publishReservation };
