package session

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/totalretail/stocktake/internal/auth"
	"github.com/totalretail/stocktake/internal/sms"
)

type Handler struct {
	svc     Service
	authSvc *auth.Service
	smsSvc  sms.Service

	counterTokenHours int
}

func NewHandler(svc Service, authSvc *auth.Service, smsSvc sms.Service, counterHours int) *Handler {
	return &Handler{svc: svc, authSvc: authSvc, smsSvc: smsSvc, counterTokenHours: counterHours}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/sessions", h.ListSessions)
	rg.POST("/sessions", h.CreateSession)
	rg.GET("/sessions/:id", h.GetSession)
	rg.PUT("/sessions/:id/status", h.UpdateStatus)

	rg.GET("/sessions/:id/counters", h.ListCounters)
	rg.POST("/sessions/:id/counters", h.AddCounter)
	rg.DELETE("/sessions/:id/counters/:counter_id", h.RemoveCounter)

	rg.POST("/sessions/:id/pull-theoretical", h.PullTheoretical)
	rg.POST("/sessions/:id/submit", h.SubmitToLS)

	rg.GET("/counter/sessions", h.GetCounterSessions)
}

func (h *Handler) ListSessions(c *gin.Context) {
	storeID := c.Query("store_id")
	sessions, err := h.svc.ListSessions(c.Request.Context(), storeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

func (h *Handler) GetSession(c *gin.Context) {
	sess, err := h.svc.GetSession(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	c.JSON(http.StatusOK, sess)
}

func (h *Handler) CreateSession(c *gin.Context) {
	var s Session
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s.CreatedBy = c.GetString("user_id")
	created, err := h.svc.CreateSession(c.Request.Context(), s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	var req struct {
		Status SessionStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.UpdateStatus(c.Request.Context(), c.Param("id"), req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": req.Status})
}

func (h *Handler) ListCounters(c *gin.Context) {
	counters, err := h.svc.ListCounters(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, counters)
}

func (h *Handler) AddCounter(c *gin.Context) {
	var req struct {
		Name   string `json:"name" binding:"required"`
		Mobile string `json:"mobile" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	counter, err := h.svc.UpsertCounter(c.Request.Context(), req.Name, req.Mobile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.AddCounter(c.Request.Context(), c.Param("id"), counter.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, counter)
}

func (h *Handler) RemoveCounter(c *gin.Context) {
	if err := h.svc.RemoveCounter(c.Request.Context(), c.Param("id"), c.Param("counter_id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"removed": true})
}

func (h *Handler) PullTheoretical(c *gin.Context) {
	if err := h.svc.PullTheoretical(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "theoretical stock pulled"})
}

func (h *Handler) SubmitToLS(c *gin.Context) {
	if err := h.svc.SubmitToLS(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "submitted to LS"})
}

func (h *Handler) GetCounterSessions(c *gin.Context) {
	counterID := c.GetString("user_id")
	sessions, err := h.svc.GetCounterSessions(c.Request.Context(), counterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}
