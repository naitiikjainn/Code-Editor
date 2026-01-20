import request from "supertest";
import { app } from "../index.js";

// Mock database connection if necessary, or ensure test DB is used
// For simple health check, it might not be strictly needed if connectDB handles errors gracefully
// However, since index.js calls connectDB(), we might want to mock it or allow it.

describe("GET /", () => {
  it("should return 200 and the welcome message", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("API & Collaboration Server is running...");
  });
});
