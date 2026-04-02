package store

import "time"

type Store struct {
	ID          string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	StoreCode   string    `json:"store_code" gorm:"uniqueIndex;not null"`
	StoreName   string    `json:"store_name" gorm:"not null"`
	LSStoreCode string    `json:"ls_store_code" gorm:"not null"`
	Active      bool      `json:"active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
}

type Zone struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	StoreID   string    `json:"store_id" gorm:"type:uuid;not null;index"`
	ZoneCode  string    `json:"zone_code" gorm:"not null"`
	ZoneName  string    `json:"zone_name" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
}

type Aisle struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ZoneID    string    `json:"zone_id" gorm:"type:uuid;not null;index"`
	AisleCode string    `json:"aisle_code" gorm:"not null"`
	AisleName string    `json:"aisle_name" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
}

type Bay struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	AisleID   string    `json:"aisle_id" gorm:"type:uuid;not null;index"`
	BayCode   string    `json:"bay_code" gorm:"not null"`
	BayName   string    `json:"bay_name" gorm:"not null"`
	Barcode   string    `json:"barcode" gorm:"uniqueIndex;not null"`
	Active    bool      `json:"active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
}

type LayoutImportRow struct {
	ZoneCode  string
	ZoneName  string
	AisleCode string
	AisleName string
	BayCode   string
	BayName   string
}