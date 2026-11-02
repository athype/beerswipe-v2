import app from "./app.ts";
import { env } from "./env.ts";

const server = app.listen(env.PORT, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${env.PORT}`);
  /* eslint-enable no-console */
});

server.on("error", (err) => {
  const error = err as NodeJS.ErrnoException;
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use. Please choose another port or stop the process using it.`);
  }
  else {
    console.error("Failed to start server:", error);
  }
  process.exit(1);
});
