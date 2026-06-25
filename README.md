# Kanban Board

A full-stack Kanban board built with React, Vite, Node.js, and Express.

## Project structure

```text
kanban-board/
  backend/    Express REST API with JSON-file persistence
  frontend/   React + Vite app with drag-and-drop
```

## Run locally

Install dependencies from the project root:

```bash
npm install
```

Start both frontend and backend:

```bash
npm run dev
```

The app runs at:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Useful scripts

```bash
npm run dev          # run frontend and backend together
npm run server       # run only the backend
npm run client       # run only the frontend
npm run build        # build frontend
```

## API

- `GET /api/health`
- `GET /api/board`
- `POST /api/cards`
- `PATCH /api/cards/:id`
- `DELETE /api/cards/:id`
- `PATCH /api/cards/:id/move`
