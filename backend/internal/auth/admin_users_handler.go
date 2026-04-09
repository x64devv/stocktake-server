package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminUserHandler struct {
	db *gorm.DB
}

func NewAdminUserHandler(db *gorm.DB) *AdminUserHandler {
	return &AdminUserHandler{db: db}
}

func (h *AdminUserHandler) RegisterAdminUserRoutes(rg *gin.RouterGroup) {
	rg.GET("/admin/users", h.List)
	rg.POST("/admin/users", h.Create)
	rg.PUT("/admin/users/:id/deactivate", h.Deactivate)
	rg.PUT("/admin/users/:id/password", h.ResetPassword)
}

func (h *AdminUserHandler) List(c *gin.Context) {
	var users []AdminUser
	if err := h.db.Order("created_at desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type safe struct {
		ID        string `json:"id"`
		Username  string `json:"username"`
		FullName  string `json:"full_name"`
		Active    bool   `json:"active"`
		CreatedAt string `json:"created_at"`
	}
	out := make([]safe, len(users))
	for i, u := range users {
		out[i] = safe{
			ID:        u.ID,
			Username:  u.Username,
			FullName:  u.FullName,
			Active:    u.Active,
			CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}
	c.JSON(http.StatusOK, out)
}

func (h *AdminUserHandler) Create(c *gin.Context) {
	var req struct {
		Username string `json:"username"  binding:"required"`
		Password string `json:"password"  binding:"required,min=8"`
		FullName string `json:"full_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}
	user := AdminUser{
		Username:     req.Username,
		PasswordHash: string(hash),
		FullName:     req.FullName,
		Active:       true,
	}
	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"full_name":  user.FullName,
		"active":     user.Active,
		"created_at": user.CreatedAt,
	})
}

func (h *AdminUserHandler) Deactivate(c *gin.Context) {
	if c.Param("id") == c.GetString("user_id") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot deactivate your own account"})
		return
	}
	if err := h.db.Model(&AdminUser{}).
		Where("id = ?", c.Param("id")).
		Update("active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deactivated": true})
}

func (h *AdminUserHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}
	if err := h.db.Model(&AdminUser{}).
		Where("id = ?", c.Param("id")).
		Update("password_hash", string(hash)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}
