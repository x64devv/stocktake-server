package ws

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type EventType string

const (
	EventCountSubmitted    EventType = "count.submitted"
	EventBinCompleted      EventType = "bin.completed"
	EventCounterConnected  EventType = "counter.connected"
	EventCounterDisconnected EventType = "counter.disconnected"
	EventSessionUpdated    EventType = "session.status_changed"
)

type Event struct {
	Type      EventType   `json:"type"`
	SessionID string      `json:"session_id"`
	Payload   interface{} `json:"payload"`
}

type client struct {
	conn      *websocket.Conn
	sessionID string
	send      chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[*client]bool // sessionID -> clients
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func NewHub() *Hub {
	return &Hub{clients: make(map[string]map[*client]bool)}
}

func (h *Hub) Broadcast(sessionID string, event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[sessionID] {
		select {
		case c.send <- data:
		default:
			close(c.send)
		}
	}
}

func (h *Hub) ServeWS(c *gin.Context) {
	sessionID := c.Param("id")
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	cl := &client{conn: conn, sessionID: sessionID, send: make(chan []byte, 64)}

	h.mu.Lock()
	if h.clients[sessionID] == nil {
		h.clients[sessionID] = make(map[*client]bool)
	}
	h.clients[sessionID][cl] = true
	h.mu.Unlock()

	// writer
	go func() {
		defer conn.Close()
		for msg := range cl.send {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				break
			}
		}
	}()

	// reader (keeps connection alive, handles pings)
	defer func() {
		h.mu.Lock()
		delete(h.clients[sessionID], cl)
		h.mu.Unlock()
		close(cl.send)
		conn.Close()
	}()
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}
