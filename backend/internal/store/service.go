package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Service interface {
	ListStores(ctx context.Context) ([]Store, error)
	GetStore(ctx context.Context, id string) (*Store, error)
	CreateStore(ctx context.Context, s Store) (*Store, error)
	UpdateStore(ctx context.Context, s Store) (*Store, error)
	GetLayout(ctx context.Context, storeID string) ([]Zone, []Aisle, []Bay, error)
	CreateZone(ctx context.Context, z Zone) (*Zone, error)
	CreateAisle(ctx context.Context, a Aisle) (*Aisle, error)
	CreateBay(ctx context.Context, b Bay) (*Bay, error)
	BulkImportLayout(ctx context.Context, storeID string, rows []LayoutImportRow) error
	GetBayByBarcode(ctx context.Context, barcode string) (*Bay, error)
}

type service struct{ db *gorm.DB }

func NewService(db *gorm.DB) Service { return &service{db: db} }

func (s *service) ListStores(ctx context.Context) ([]Store, error) {
	var stores []Store
	err := s.db.WithContext(ctx).Where("active = ?", true).Order("store_name").Find(&stores).Error
	return stores, err
}

func (s *service) GetStore(ctx context.Context, id string) (*Store, error) {
	var st Store
	err := s.db.WithContext(ctx).First(&st, "id = ?", id).Error
	return &st, err
}

func (s *service) CreateStore(ctx context.Context, st Store) (*Store, error) {
	err := s.db.WithContext(ctx).Create(&st).Error
	return &st, err
}

func (s *service) UpdateStore(ctx context.Context, st Store) (*Store, error) {
	err := s.db.WithContext(ctx).Save(&st).Error
	return &st, err
}

func (s *service) GetLayout(ctx context.Context, storeID string) ([]Zone, []Aisle, []Bay, error) {
	var zones []Zone
	if err := s.db.WithContext(ctx).Where("store_id = ?", storeID).Order("zone_code").Find(&zones).Error; err != nil {
		return nil, nil, nil, err
	}

	var aisles []Aisle
	if err := s.db.WithContext(ctx).
		Joins("JOIN zones ON zones.id = aisles.zone_id").
		Where("zones.store_id = ?", storeID).
		Order("aisles.aisle_code").
		Find(&aisles).Error; err != nil {
		return nil, nil, nil, err
	}

	var bays []Bay
	if err := s.db.WithContext(ctx).
		Joins("JOIN aisles ON aisles.id = bays.aisle_id").
		Joins("JOIN zones ON zones.id = aisles.zone_id").
		Where("zones.store_id = ? AND bays.active = ?", storeID, true).
		Order("bays.bay_code").
		Find(&bays).Error; err != nil {
		return nil, nil, nil, err
	}

	return zones, aisles, bays, nil
}

func (s *service) CreateZone(ctx context.Context, z Zone) (*Zone, error) {
	err := s.db.WithContext(ctx).Create(&z).Error
	return &z, err
}

func (s *service) CreateAisle(ctx context.Context, a Aisle) (*Aisle, error) {
	err := s.db.WithContext(ctx).Create(&a).Error
	return &a, err
}

func (s *service) CreateBay(ctx context.Context, b Bay) (*Bay, error) {
	if b.Barcode == "" {
		b.Barcode = fmt.Sprintf("BAY-%s", uuid.New().String()[:8])
	}
	err := s.db.WithContext(ctx).Create(&b).Error
	return &b, err
}

func (s *service) BulkImportLayout(ctx context.Context, storeID string, importRows []LayoutImportRow) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		zoneMap := map[string]string{}
		aisleMap := map[string]string{}

		for _, row := range importRows {
			if _, ok := zoneMap[row.ZoneCode]; !ok {
				z := Zone{StoreID: storeID, ZoneCode: row.ZoneCode, ZoneName: row.ZoneName}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "store_id"}, {Name: "zone_code"}},
					DoUpdates: clause.AssignmentColumns([]string{"zone_name"}),
				}).Create(&z).Error; err != nil {
					return fmt.Errorf("upsert zone %s: %w", row.ZoneCode, err)
				}
				zoneMap[row.ZoneCode] = z.ID
			}

			aisleKey := row.ZoneCode + "|" + row.AisleCode
			if _, ok := aisleMap[aisleKey]; !ok {
				a := Aisle{ZoneID: zoneMap[row.ZoneCode], AisleCode: row.AisleCode, AisleName: row.AisleName}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "zone_id"}, {Name: "aisle_code"}},
					DoUpdates: clause.AssignmentColumns([]string{"aisle_name"}),
				}).Create(&a).Error; err != nil {
					return fmt.Errorf("upsert aisle %s: %w", row.AisleCode, err)
				}
				aisleMap[aisleKey] = a.ID
			}

			barcode := fmt.Sprintf("BAY-%s-%s", row.AisleCode, row.BayCode)
			b := Bay{AisleID: aisleMap[aisleKey], BayCode: row.BayCode, BayName: row.BayName, Barcode: barcode}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "aisle_id"}, {Name: "bay_code"}},
				DoUpdates: clause.AssignmentColumns([]string{"bay_name"}),
			}).Create(&b).Error; err != nil {
				return fmt.Errorf("upsert bay %s: %w", row.BayCode, err)
			}
		}
		return nil
	})
}

func (s *service) GetBayByBarcode(ctx context.Context, barcode string) (*Bay, error) {
	var b Bay
	err := s.db.WithContext(ctx).First(&b, "barcode = ?", barcode).Error
	return &b, err
}