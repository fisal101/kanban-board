async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const error = await response.json();
      message = error.message || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getBoard() {
  return request("/api/board");
}

export function createCard(card) {
  return request("/api/cards", {
    method: "POST",
    body: JSON.stringify(card)
  });
}

export function updateCard(id, card) {
  return request(`/api/cards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(card)
  });
}

export function deleteCard(id) {
  return request(`/api/cards/${id}`, {
    method: "DELETE"
  });
}

export function moveCard(id, move) {
  return request(`/api/cards/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify(move)
  });
}
