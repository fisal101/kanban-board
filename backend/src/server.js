import express from "express";
import cors from "cors";
import {
  createCard,
  deleteCard,
  getBoard,
  moveCard,
  updateCard
} from "./store.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/board", async (req, res, next) => {
  try {
    res.json(await getBoard());
  } catch (error) {
    next(error);
  }
});

app.post("/api/cards", async (req, res, next) => {
  try {
    const card = await createCard(req.body);
    res.status(201).json(card);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/cards/:id", async (req, res, next) => {
  try {
    res.json(await updateCard(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cards/:id", async (req, res, next) => {
  try {
    await deleteCard(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.patch("/api/cards/:id/move", async (req, res, next) => {
  try {
    res.json(await moveCard(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  const message = status === 500 ? "Something went wrong" : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({ message });
});

app.listen(port, () => {
  console.log(`Kanban API running on http://localhost:${port}`);
});
