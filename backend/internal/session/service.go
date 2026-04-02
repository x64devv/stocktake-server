package session

import (
	"context"
	"fmt"

	"github.com/totalretail/stocktake/internal/auth"
	"github.com/totalretail/stocktake/internal/ls"
	"gorm.io/gorm"
)

type Service interface {
	ListSessions(ctx context.Context, storeID string) ([]Session, error)
	GetSession(ctx context.Context, id string) (*Session, error)
	CreateSession(ctx context.Context, s Session) (*Session, error)
	UpdateStatus(ctx context.Context, id string, status SessionStatus) error
	AddCounter(ctx context.Context, sessionID, counterID string) error
	RemoveCounter(ctx context.Context, sessionID, counterID string) error
	PullTheoretical(ctx context.Context, sessionID string) error
	SubmitToLS(ctx context.Context, sessionID string) error
	UpsertCounter(ctx context.Context, name, mobile string) (*auth.Counter, error)
	ListCounters(ctx context.Context, sessionID string) ([]auth.Counter, error)
	GetCounterSessions(ctx context.Context, counterID string) ([]Session, error)
}

type service struct {
	db       *gorm.DB
	lsClient *ls.Client
}

func NewService(db *gorm.DB, lsClient *ls.Client) Service {
	return &service{db: db, lsClient: lsClient}
}

func (s *service) ListSessions(ctx context.Context, storeID string) ([]Session, error) {
	var sessions []Session
	q := s.db.WithContext(ctx).Order("created_at desc")
	if storeID != "" {
		q = q.Where("store_id = ?", storeID)
	}
	return sessions, q.Find(&sessions).Error
}

func (s *service) GetSession(ctx context.Context, id string) (*Session, error) {
	var sess Session
	return &sess, s.db.WithContext(ctx).First(&sess, "id = ?", id).Error
}

func (s *service) CreateSession(ctx context.Context, sess Session) (*Session, error) {
	var count int64
	s.db.WithContext(ctx).Model(&Session{}).
		Where("store_id = ? AND status IN ?", sess.StoreID,
			[]string{"ACTIVE", "COUNTING_COMPLETE", "PENDING_REVIEW"}).
		Count(&count)
	if count > 0 {
		return nil, fmt.Errorf("store already has an active stock take session")
	}
	sess.Status = StatusDraft
	return &sess, s.db.WithContext(ctx).Create(&sess).Error
}

func (s *service) UpdateStatus(ctx context.Context, id string, status SessionStatus) error {
	return s.db.WithContext(ctx).Model(&Session{}).Where("id = ?", id).Update("status", status).Error
}

func (s *service) UpsertCounter(ctx context.Context, name, mobile string) (*auth.Counter, error) {
	c := auth.Counter{Name: name, MobileNumber: mobile}
	err := s.db.WithContext(ctx).
		Where(auth.Counter{MobileNumber: mobile}).
		Assign(auth.Counter{Name: name}).
		FirstOrCreate(&c).Error
	return &c, err
}

func (s *service) AddCounter(ctx context.Context, sessionID, counterID string) error {
	sc := SessionCounter{SessionID: sessionID, CounterID: counterID, Active: true}
	return s.db.WithContext(ctx).
		Where(SessionCounter{SessionID: sessionID, CounterID: counterID}).
		FirstOrCreate(&sc).Error
}

func (s *service) RemoveCounter(ctx context.Context, sessionID, counterID string) error {
	return s.db.WithContext(ctx).Model(&SessionCounter{}).
		Where("session_id = ? AND counter_id = ?", sessionID, counterID).
		Update("active", false).Error
}

func (s *service) ListCounters(ctx context.Context, sessionID string) ([]auth.Counter, error) {
	var counters []auth.Counter
	err := s.db.WithContext(ctx).
		Joins("JOIN session_counters ON session_counters.counter_id = counters.id").
		Where("session_counters.session_id = ? AND session_counters.active = ?", sessionID, true).
		Order("counters.name").
		Find(&counters).Error
	return counters, err
}

func (s *service) GetCounterSessions(ctx context.Context, counterID string) ([]Session, error) {
	var sessions []Session
	err := s.db.WithContext(ctx).
		Joins("JOIN session_counters ON session_counters.session_id = sessions.id").
		Where("session_counters.counter_id = ? AND session_counters.active = ? AND sessions.status = ?",
			counterID, true, StatusActive).
		Order("sessions.session_date desc").
		Find(&sessions).Error
	return sessions, err
}

func (s *service) PullTheoretical(ctx context.Context, sessionID string) error {
	var store struct{ LSStoreCode string }
	if err := s.db.WithContext(ctx).Raw(
		`SELECT stores.ls_store_code FROM stores
		 JOIN sessions ON sessions.store_id = stores.id
		 WHERE sessions.id = ?`, sessionID,
	).Scan(&store).Error; err != nil {
		return fmt.Errorf("get store LS code: %w", err)
	}

	lines, err := s.lsClient.GetWorksheetLines(ctx, store.LSStoreCode)
	if err != nil {
		return fmt.Errorf("fetch LS worksheet: %w", err)
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tx.Where("session_id = ?", sessionID).Delete(&TheoreticalStock{})
		for _, line := range lines {
			if err := tx.Create(&TheoreticalStock{
				SessionID:      sessionID,
				ItemNo:         line.ItemNo,
				TheoreticalQty: line.TheoreticalQty,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *service) SubmitToLS(ctx context.Context, sessionID string) error {
	type result struct {
		ItemNo   string
		TotalQty float64
	}
	var results []result
	if err := s.db.WithContext(ctx).Raw(`
		SELECT item_no, COALESCE(SUM(quantity), 0) AS total_qty
		FROM count_lines
		WHERE session_id = ? AND round_no = (
			SELECT MAX(round_no) FROM count_lines cl2
			WHERE cl2.session_id = count_lines.session_id AND cl2.item_no = count_lines.item_no
		)
		GROUP BY item_no`, sessionID).Scan(&results).Error; err != nil {
		return err
	}

	var store struct{ LSStoreCode string }
	s.db.WithContext(ctx).Raw(
		`SELECT stores.ls_store_code FROM stores
		 JOIN sessions ON sessions.store_id = stores.id WHERE sessions.id = ?`, sessionID,
	).Scan(&store)

	var wsLines []ls.WorksheetLine
	for _, r := range results {
		wsLines = append(wsLines, ls.WorksheetLine{ItemNo: r.ItemNo, TheoreticalQty: r.TotalQty})
	}

	if err := s.lsClient.PostFinalCounts(ctx, store.LSStoreCode, wsLines); err != nil {
		return err
	}
	return s.UpdateStatus(ctx, sessionID, StatusSubmitted)
}