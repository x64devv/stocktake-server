package session

import "time"

type SessionType   string
type SessionStatus string

const (
	TypeFull    SessionType = "FULL"
	TypePartial SessionType = "PARTIAL"

	StatusDraft         SessionStatus = "DRAFT"
	StatusActive        SessionStatus = "ACTIVE"
	StatusCountingDone  SessionStatus = "COUNTING_COMPLETE"
	StatusPendingReview SessionStatus = "PENDING_REVIEW"
	StatusSubmitted     SessionStatus = "SUBMITTED"
	StatusClosed        SessionStatus = "CLOSED"
)

type Session struct {
	ID          string        `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	StoreID     string        `json:"store_id" gorm:"type:uuid;not null;index"`
	SessionDate string        `json:"session_date" gorm:"type:date;not null"`
	Type        SessionType   `json:"type" gorm:"type:varchar(20);not null;default:'FULL'"`
	Status      SessionStatus `json:"status" gorm:"type:varchar(30);not null;default:'DRAFT'"`
	CreatedBy   string        `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt   time.Time     `json:"created_at"`
}

type SessionItem struct {
	SessionID   string `json:"session_id" gorm:"type:uuid;primaryKey"`
	ItemNo      string `json:"item_no" gorm:"primaryKey"`
	Description string `json:"description"`
	Barcode     string `json:"barcode"`
	UoM         string `json:"uom"`
}


type SessionCounter struct {
	SessionID  string    `json:"session_id" gorm:"type:uuid;primaryKey"`
	CounterID  string    `json:"counter_id" gorm:"type:uuid;primaryKey"`
	AssignedAt time.Time `json:"assigned_at" gorm:"autoCreateTime"`
	Active     bool      `json:"active" gorm:"default:true"`
}

type TheoreticalStock struct {
	SessionID      string  `json:"session_id" gorm:"type:uuid;primaryKey"`
	ItemNo         string  `json:"item_no" gorm:"primaryKey"`
	TheoreticalQty float64 `json:"theoretical_qty" gorm:"type:numeric(14,4)"`
}
