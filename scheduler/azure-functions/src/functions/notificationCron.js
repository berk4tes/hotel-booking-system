const { app } = require("@azure/functions");

async function callNotificationEndpoint(baseUrl, path, context) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${body}`);
  }

  context.log(`${path} completed: ${body}`);
}

app.timer("notificationCron", {
  schedule: "0 0 2 * * *",
  handler: async (timer, context) => {
    const notificationUrl = process.env.NOTIFICATION_URL;

    if (!notificationUrl) {
      throw new Error("NOTIFICATION_URL is required");
    }

    await callNotificationEndpoint(notificationUrl, "/cron/check-capacity", context);
    await callNotificationEndpoint(notificationUrl, "/cron/process-reservations", context);
  }
});
