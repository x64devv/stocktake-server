package session

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/totalretail/stocktake/internal/auth"
	"github.com/totalretail/stocktake/internal/sms"
)

type Handler struct {
	svc               Service
	authSvc           *auth.Service
	smsSvc            sms.Service
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
	rg.POST("/sessions/:id/counters/:counter_id/resend-otp", h.ResendOTP)

	rg.POST("/sessions/:id/pull-theoretical", h.PullTheoretical)
	rg.POST("/sessions/:id/submit", h.SubmitToLS)

	rg.GET("/ls/worksheets", h.GetAvailableWorksheets)
	rg.PUT("/sessions/:id", h.UpdateSession)

	rg.GET("/counter/sessions", h.GetCounterSessions)
}


func (h *Handler) GetAvailableWorksheets(c *gin.Context) {
	worksheets, err := h.svc.GetAvailableWorksheets(c.Request.Context())
	if err != nil {
		// Return empty list rather than error — LS may not be configured yet
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, worksheets)
}

func (h *Handler) UpdateSession(c *gin.Context) {
	var req struct {
		WorksheetNo string `json:"worksheet_no"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sess, err := h.svc.UpdateSession(c.Request.Context(), c.Param("id"), req.WorksheetNo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sess)
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
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
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
		Name   string `json:"name"   binding:"required"`
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

// ResendOTP generates a fresh OTP and sends it to the counter's mobile number (§4.2).
func (h *Handler) ResendOTP(c *gin.Context) {
	counters, err := h.svc.ListCounters(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var mobile string
	for _, ct := range counters {
		if ct.ID == c.Param("counter_id") {
			mobile = ct.MobileNumber
			break
		}
	}
	if mobile == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "counter not found on this session"})
		return
	}
	otp, err := h.authSvc.GenerateOTP(c.Request.Context(), mobile)
	if err != nil {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
		return
	}
	if err := h.smsSvc.Send(c.Request.Context(), mobile,
		"Your StockTake OTP is: "+otp+". Valid for 10 minutes."); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send OTP"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sent": true})
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
