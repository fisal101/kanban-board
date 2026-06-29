import { useEffect, useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CirclePlus, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import * as api from "./api.js";

const emptyForm = {
  id: null,
  title: "",
  description: "",
  priority: "medium",
  columnId: "todo"
};

const cardPriorities = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" }
];

function getPriority(card) {
  return cardPriorities.some((priority) => priority.id === card.priority) ? card.priority : "medium";
}

function getPriorityLabel(card) {
  return cardPriorities.find((priority) => priority.id === getPriority(card))?.label || "Medium";
}

function groupCards(columns, cards) {
  const grouped = Object.fromEntries(columns.map((column) => [column.id, []]));

  for (const card of cards) {
    if (!grouped[card.columnId]) {
      grouped[card.columnId] = [];
    }

    grouped[card.columnId].push(card);
  }

  for (const column of columns) {
    grouped[column.id].sort((a, b) => a.order - b.order);
  }

  return grouped;
}

function findCardLocation(groupedCards, cardId) {
  for (const [columnId, cards] of Object.entries(groupedCards)) {
    const index = cards.findIndex((card) => card.id === cardId);

    if (index >= 0) {
      return { columnId, index };
    }
  }

  return null;
}

function makeBoard(columns, groupedCards) {
  return {
    columns,
    cards: columns.flatMap((column) =>
      (groupedCards[column.id] || []).map((card, index) => ({
        ...card,
        columnId: column.id,
        order: index
      }))
    )
  };
}

function getDropTarget(overId, groupedCards) {
  if (!overId) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(groupedCards, overId)) {
    return {
      columnId: overId,
      index: groupedCards[overId].length
    };
  }

  const cardLocation = findCardLocation(groupedCards, overId);

  if (!cardLocation) {
    return null;
  }

  return {
    columnId: cardLocation.columnId,
    index: cardLocation.index
  };
}

function Card({ card, onEdit, onDelete, dragging = false }) {
  return (
    <article className={`task-card ${dragging ? "is-dragging" : ""}`}>
      <div>
        <div className="card-title-row">
          <h3>{card.title}</h3>
          <span className={`priority-badge priority-${getPriority(card)}`}>
            {getPriorityLabel(card)}
          </span>
        </div>
        {card.description ? <p>{card.description}</p> : null}
      </div>
      <div className="card-actions">
        <button className="icon-button" type="button" onClick={() => onEdit(card)} title="Edit card">
          <Pencil size={16} />
        </button>
        <button
          className="icon-button danger"
          type="button"
          onClick={() => onDelete(card)}
          title="Delete card"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function SortableCard({ card, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card card={card} onEdit={onEdit} onDelete={onDelete} dragging={isDragging} />
    </div>
  );
}

function Column({ column, cards, onAddCard, onEditCard, onDeleteCard }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" }
  });

  return (
    <section className={`board-column ${isOver ? "is-over" : ""}`}>
      <header className="column-header">
        <div>
          <h2>{column.title}</h2>
          <span>{cards.length} cards</span>
        </div>
        <button
          className="icon-button strong"
          type="button"
          onClick={() => onAddCard(column.id)}
          title={`Add card to ${column.title}`}
        >
          <Plus size={18} />
        </button>
      </header>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="card-list" ref={setNodeRef}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onEdit={onEditCard} onDelete={onDeleteCard} />
          ))}
          {cards.length === 0 ? (
            <button className="empty-column" type="button" onClick={() => onAddCard(column.id)}>
              <CirclePlus size={18} />
              Add first card
            </button>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function CardModal({ columns, form, saving, error, onChange, onSubmit, onClose }) {
  if (!form) {
    return null;
  }

  const isEditing = Boolean(form.id);

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="card-modal" onSubmit={onSubmit}>
        <header>
          <h2>{isEditing ? "Edit card" : "New card"}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </header>

        <label>
          Title
          <input
            autoFocus
            required
            maxLength={120}
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            placeholder="Write a clear task title"
          />
        </label>

        <label>
          Description
          <textarea
            rows={4}
            maxLength={500}
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
            placeholder="Add useful details"
          />
        </label>

        <label>
          Priority
          <select
            value={form.priority}
            onChange={(event) => onChange({ ...form, priority: event.target.value })}
          >
            {cardPriorities.map((priority) => (
              <option key={priority.id} value={priority.id}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Column
          <select
            value={form.columnId}
            onChange={(event) => onChange({ ...form, columnId: event.target.value })}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : null}
            {isEditing ? "Save changes" : "Create card"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [board, setBoard] = useState({ columns: [], cards: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const groupedCards = useMemo(() => groupCards(board.columns, board.cards), [board]);

  async function loadBoard() {
    setError("");
    setLoading(true);

    try {
      setBoard(await api.getBoard());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
  }, []);

  function openNewCard(columnId) {
    setForm({ ...emptyForm, columnId });
    setFormError("");
  }

  function openEditCard(card) {
    setForm({
      id: card.id,
      title: card.title,
      description: card.description || "",
      priority: getPriority(card),
      columnId: card.columnId
    });
    setFormError("");
  }

  async function submitCard(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      if (form.id) {
        await api.updateCard(form.id, {
          title: form.title,
          description: form.description,
          priority: form.priority
        });

        if (form.columnId !== board.cards.find((card) => card.id === form.id)?.columnId) {
          await api.moveCard(form.id, {
            columnId: form.columnId,
            order: groupedCards[form.columnId]?.length || 0
          });
        }
      } else {
        await api.createCard({
          title: form.title,
          description: form.description,
          priority: form.priority,
          columnId: form.columnId
        });
      }

      setForm(null);
      await loadBoard();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCard(card) {
    const confirmed = window.confirm(`Delete "${card.title}"?`);

    if (!confirmed) {
      return;
    }

    const previousBoard = board;
    setBoard((current) => ({
      ...current,
      cards: current.cards.filter((item) => item.id !== card.id)
    }));

    try {
      await api.deleteCard(card.id);
      await loadBoard();
    } catch (requestError) {
      setBoard(previousBoard);
      setError(requestError.message);
    }
  }

  function handleDragStart(event) {
    const card = board.cards.find((item) => item.id === event.active.id);
    setActiveCard(card || null);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || active.id === over.id) {
      return;
    }

    const source = findCardLocation(groupedCards, active.id);
    const target = getDropTarget(over.id, groupedCards);

    if (!source || !target) {
      return;
    }

    const nextGrouped = Object.fromEntries(
      Object.entries(groupedCards).map(([columnId, cards]) => [columnId, [...cards]])
    );
    const [movedCard] = nextGrouped[source.columnId].splice(source.index, 1);
    const targetIndex =
      source.columnId === target.columnId && source.index < target.index
        ? target.index - 1
        : target.index;

    nextGrouped[target.columnId].splice(targetIndex, 0, movedCard);

    const nextBoard = makeBoard(board.columns, nextGrouped);
    const previousBoard = board;
    setBoard(nextBoard);

    try {
      await api.moveCard(active.id, {
        columnId: target.columnId,
        order: targetIndex
      });
      await loadBoard();
    } catch (requestError) {
      setBoard(previousBoard);
      setError(requestError.message);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p>Project workflow</p>
          <h1>Kanban Board</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => openNewCard("todo")}>
          <Plus size={18} />
          Add card
        </button>
      </header>

      {error ? (
        <div className="status-banner error">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={loadBoard}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spin" size={26} />
          Loading board
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCard(null)}
        >
          <div className="board-grid">
            {board.columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                cards={groupedCards[column.id] || []}
                onAddCard={openNewCard}
                onEditCard={openEditCard}
                onDeleteCard={removeCard}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCard ? (
              <Card card={activeCard} onEdit={() => {}} onDelete={() => {}} dragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <CardModal
        columns={board.columns}
        form={form}
        saving={saving}
        error={formError}
        onChange={setForm}
        onSubmit={submitCard}
        onClose={() => setForm(null)}
      />
    </main>
  );
}
