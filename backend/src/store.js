import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "boards.json");

const defaultBoard = {
  columns: [
    { id: "todo", title: "Todo", order: 0 },
    { id: "in-progress", title: "In Progress", order: 1 },
    { id: "done", title: "Done", order: 2 }
  ],
  cards: [
    {
      id: "sample-1",
      title: "Map the board workflow",
      description: "Sketch the first columns and card states for the project.",
      columnId: "todo",
      order: 0,
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z"
    },
    {
      id: "sample-2",
      title: "Build the API",
      description: "Expose CRUD and move endpoints backed by JSON storage.",
      columnId: "in-progress",
      order: 0,
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z"
    },
    {
      id: "sample-3",
      title: "Create the React UI",
      description: "Render columns, cards, forms, and drag interactions.",
      columnId: "done",
      order: 0,
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z"
    }
  ]
};

let writeQueue = Promise.resolve();

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await writeBoard(defaultBoard);
  }
}

function cloneBoard(board) {
  return {
    columns: [...board.columns].sort((a, b) => a.order - b.order),
    cards: [...board.cards].sort((a, b) => {
      if (a.columnId === b.columnId) {
        return a.order - b.order;
      }

      return a.columnId.localeCompare(b.columnId);
    })
  };
}

function normalizeColumnOrders(board) {
  board.columns
    .sort((a, b) => a.order - b.order)
    .forEach((column, index) => {
      column.order = index;
    });
}

function normalizeCardOrders(board) {
  for (const column of board.columns) {
    board.cards
      .filter((card) => card.columnId === column.id)
      .sort((a, b) => a.order - b.order)
      .forEach((card, index) => {
        card.order = index;
      });
  }
}

async function readBoard() {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  const board = JSON.parse(raw);
  normalizeColumnOrders(board);
  normalizeCardOrders(board);
  return board;
}

async function writeBoard(board) {
  await mkdir(dataDir, { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(cloneBoard(board), null, 2)}\n`, "utf8");
  await rename(tempFile, dataFile);
}

async function mutateBoard(mutator) {
  const operation = writeQueue.then(async () => {
    const board = await readBoard();
    const result = mutator(board);
    normalizeColumnOrders(board);
    normalizeCardOrders(board);
    await writeBoard(board);
    return result;
  });

  writeQueue = operation.catch(() => {});
  return operation;
}

function findCard(board, id) {
  const card = board.cards.find((item) => item.id === id);

  if (!card) {
    throw httpError(404, "Card not found");
  }

  return card;
}

function assertColumn(board, columnId) {
  const column = board.columns.find((item) => item.id === columnId);

  if (!column) {
    throw httpError(400, "Column does not exist");
  }

  return column;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getBoard() {
  const board = await readBoard();
  return cloneBoard(board);
}

export async function createCard(input) {
  return mutateBoard((board) => {
    const title = cleanString(input.title);
    const description = cleanString(input.description);
    const columnId = cleanString(input.columnId) || "todo";

    if (!title) {
      throw httpError(400, "Title is required");
    }

    assertColumn(board, columnId);

    const now = new Date().toISOString();
    const order = board.cards.filter((card) => card.columnId === columnId).length;
    const card = {
      id: crypto.randomUUID(),
      title,
      description,
      columnId,
      order,
      createdAt: now,
      updatedAt: now
    };

    board.cards.push(card);
    return card;
  });
}

export async function updateCard(id, input) {
  return mutateBoard((board) => {
    const card = findCard(board, id);
    const nextTitle = input.title === undefined ? card.title : cleanString(input.title);
    const nextDescription =
      input.description === undefined ? card.description : cleanString(input.description);

    if (!nextTitle) {
      throw httpError(400, "Title is required");
    }

    card.title = nextTitle;
    card.description = nextDescription;
    card.updatedAt = new Date().toISOString();
    return card;
  });
}

export async function deleteCard(id) {
  return mutateBoard((board) => {
    findCard(board, id);
    board.cards = board.cards.filter((card) => card.id !== id);
    return null;
  });
}

export async function moveCard(id, input) {
  return mutateBoard((board) => {
    const card = findCard(board, id);
    const columnId = cleanString(input.columnId);
    const requestedOrder = Number.isInteger(input.order) ? input.order : 0;

    assertColumn(board, columnId);

    const remainingCards = board.cards.filter((item) => item.id !== id);
    const destinationCards = remainingCards
      .filter((item) => item.columnId === columnId)
      .sort((a, b) => a.order - b.order);
    const safeOrder = Math.max(0, Math.min(requestedOrder, destinationCards.length));

    card.columnId = columnId;
    card.order = safeOrder;
    card.updatedAt = new Date().toISOString();
    destinationCards.splice(safeOrder, 0, card);

    board.cards = [
      ...remainingCards.filter((item) => item.columnId !== columnId),
      ...destinationCards
    ];

    return card;
  });
}
