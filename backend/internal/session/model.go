package session

import "time"

type SessionType   string
type SessionStatus string

const (
	// Deprecated – kept only for existing data migration safety
	TypeFull SessionType = "FULL"

	// Current session types
	TypeFloor      SessionType = "FLOOR"
	TypeBakery     SessionType = "BAKERY"
	TypeButchery   SessionType = "BUTCHERY"
	TypeFruitVeg   SessionType = "FRUIT_VEG"
	TypeDeliCold   SessionType = "DELI_COLD"
	TypeDeliHot    SessionType = "DELI_HOT"
	TypeQSR        SessionType = "QSR"
	TypeRestaurant SessionType = "RESTAURANT"
	TypePartial    SessionType = "PARTIAL"

	StatusDraft         SessionStatus = "DRAFT"
	StatusActive        SessionStatus = "ACTIVE"
	StatusCountingDone  SessionStatus = "COUNTING_COMPLETE"
	StatusPendingReview SessionStatus = "PENDING_REVIEW"
	StatusSubmitted     SessionStatus = "SUBMITTED"
	StatusClosed        SessionStatus = "CLOSED"
)

// SessionTypes returns all valid session types for use in validation and UI.
var SessionTypes = []SessionType{
	TypeFloor, TypeBakery, TypeButchery, TypeFruitVeg,
	TypeDeliCold, TypeDeliHot, TypeQSR, TypeRestaurant, TypePartial,
}

// IsPartial returns true only for PARTIAL sessions (admin-selected item list).
func (t SessionType) IsPartial() bool {
	return t == TypePartial
}

// IsValid checks the type is a known value.
func (t SessionType) IsValid() bool {
	for _, v := range SessionTypes {
		if t == v {
			return true
		}
	}
	// Accept legacy FULL during transition
	return t == TypeFull
}

type Session struct {
	ID                   string        `json:"id"                     gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	StoreID              string        `json:"store_id"               gorm:"type:uuid;not null;index"`
	SessionDate          string        `json:"session_date"           gorm:"type:date;not null"`
	Type                 SessionType   `json:"type"                   gorm:"type:varchar(20);not null;default:'FLOOR'"`
	Status               SessionStatus `json:"status"                 gorm:"type:varchar(30);not null;default:'DRAFT'"`
	VarianceTolerancePct float64       `json:"variance_tolerance_pct" gorm:"type:numeric(6,2);not null;default:2.0"`
	WorksheetNo          *string       `json:"worksheet_no"           gorm:"type:text"`
	CreatedBy            string        `json:"created_by"             gorm:"type:uuid;not null"`
	CreatedAt            time.Time     `json:"created_at"`
}

type SessionItem struct {
	SessionID   string `json:"session_id"  gorm:"type:uuid;primaryKey"`
	ItemNo      string `json:"item_no"     gorm:"primaryKey"`
	Description string `json:"description"`
	Barcode     string `json:"barcode"`
	UoM         string `json:"uo_m"`
}

type SessionCounter struct {
	SessionID  string    `json:"session_id"  gorm:"type:uuid;primaryKey"`
	CounterID  string    `json:"counter_id"  gorm:"type:uuid;primaryKey"`
	AssignedAt time.Time `json:"assigned_at" gorm:"autoCreateTime"`
	Active     bool      `json:"active"      gorm:"default:true"`
}

type TheoreticalStock struct {
	SessionID      string  `json:"session_id"      gorm:"type:uuid;primaryKey"`
	ItemNo         string  `json:"item_no"         gorm:"primaryKey"`
	TheoreticalQty float64 `json:"theoretical_qty" gorm:"type:numeric(14,4)"`
}