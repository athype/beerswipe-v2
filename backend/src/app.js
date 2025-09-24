import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import api from "./api/index.js";
import { initializeDatabase } from "./config/database.js";
import { env } from "./env.js";

import * as middlewares from "./middlewares.js";

const app = express();

try {
  await initializeDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

app.use(morgan("dev"));
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // In development, allow localhost on any port
    if (env.NODE_ENV === 'development') {
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // Production: Allow specific origins
    const allowedOrigins = [
      `${env.FEURL}:${env.FEPORT}`, // Development frontend
      env.FEURL, // Production frontend (port 80, no need to specify)
      'http://localhost', // Production frontend on port 80
      'http://localhost:80', // Production frontend with explicit port
      "http://localhost:5173" // Production frontend on port 5173
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log(`CORS blocked origin: ${origin}, allowed origins: ${allowedOrigins.join(', ')}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Beer Machine API - Ready to serve!",
  });
});

app.use("/api/v1", api);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
