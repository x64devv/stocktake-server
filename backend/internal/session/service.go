package session

import (
	"context"
	"fmt"

	"github.com/totalretail/stocktake/internal/auth"
	"github.com/totalretail/stocktake/internal/ls"
	"github.com/totalretail/stocktake/internal/ws"
	"gorm.io/gorm"
)

type Service interface {
	ListSessions(ctx context.Context, storeID string) ([]Session, error)
	GetSession(ctx context.Context, id string) (*Session, error)
	CreateSession(ctx context.Context, s Session) (*Session, error)
	UpdateSession(ctx context.Context, id string, worksheetNo string) (*Session, error)
	UpdateStatus(ctx context.Context, id string, status SessionStatus) error
	AddCounter(ctx context.Context, sessionID, counterID string) error
	RemoveCounter(ctx context.Context, sessionID, counterID string) error
	PullTheoretical(ctx context.Context, sessionID string) error
	SubmitToLS(ctx context.Context, sessionID string) error
	UpsertCounter(ctx context.Context, name, mobile string) (*auth.Counter, error)
	ListCounters(ctx context.Context, sessionID string) ([]auth.Counter, error)
	GetCounterSessions(ctx context.Context, counterID string) ([]Session, error)
	GetAvailableWorksheets(ctx context.Context) ([]ls.AvailableWorksheet, error)
}

type service struct {
	db       *gorm.DB
	lsClient *ls.Client
	hub      *ws.Hub
}

// strVal safely dereferences a *string, returning "" if nil
func strVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func NewService(db *gorm.DB, lsClient *ls.Client, hub *ws.Hub) Service {
	return &service{db: db, lsClient: lsClient, hub: hub}
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
	if sess.Type != TypePartial {
		var count int64
		s.db.WithContext(ctx).Model(&Session{}).
			Where("store_id = ? AND type = ? AND status IN ?", sess.StoreID, sess.Type,
				[]string{"DRAFT", "ACTIVE", "COUNTING_COMPLETE", "PENDING_REVIEW"}).
			Count(&count)
		if count > 0 {
			return nil, fmt.Errorf("store already has an active %s stock take session", sess.Type)
		}
	}
	sess.Status = StatusDraft
	if sess.VarianceTolerancePct == 0 {
		sess.VarianceTolerancePct = 2.0
	}
	if err := s.db.WithContext(ctx).Create(&sess).Error; err != nil {
		return nil, err
	}

	// Auto-pull theoreticals if a worksheet was linked at creation
	if strVal(sess.WorksheetNo) != "" {
    if err := s.pullTheoreticalByBatch(ctx, sess.ID, strVal(sess.WorksheetNo)); err != nil {
        _ = err
    }
}
	if strVal(sess.WorksheetNo) != "" {
    if err := s.pullTheoreticalByBatch(ctx, sess.ID, strVal(sess.WorksheetNo)); err != nil {
        _ = err
    }
}

	return &sess, nil
}

// UpdateSession updates the linked worksheet and re-pulls theoreticals
func (s *service) UpdateSession(ctx context.Context, id string, worksheetNo string) (*Session, error) {
	if err := s.db.WithContext(ctx).Model(&Session{}).
		Where("id = ?", id).
		Update("worksheet_no", worksheetNo).Error; err != nil {
		return nil, err
	}

	// Re-pull theoreticals with the new worksheet
	if worksheetNo != "" {
		if err := s.pullTheoreticalByBatch(ctx, id, worksheetNo); err != nil {
			return nil, fmt.Errorf("worksheet updated but theoretical pull failed: %w", err)
		}
	}

	return s.GetSession(ctx, id)
}

func (s *service) UpdateStatus(ctx context.Context, id string, status SessionStatus) error {
	if err := s.db.WithContext(ctx).Model(&Session{}).
		Where("id = ?", id).
		Update("status", status).Error; err != nil {
		return err
	}
	s.hub.Broadcast(id, ws.Event{
		Type:      ws.EventSessionUpdated,
		SessionID: id,
		Payload:   map[string]string{"status": string(status)},
	})
	return nil
}

func (s *service) GetAvailableWorksheets(ctx context.Context) ([]ls.AvailableWorksheet, error) {
	return s.lsClient.GetAvailableWorksheets(ctx)
}

// PullTheoretical is the manual trigger — uses the session's stored worksheet_no
func (s *service) PullTheoretical(ctx context.Context, sessionID string) error {
	sess, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}
	if strVal(sess.WorksheetNo) == "" {
		return fmt.Errorf("no worksheet linked to this session — set a worksheet first")
	}
	return s.pullTheoreticalByBatch(ctx, sessionID, strVal(sess.WorksheetNo))
}

// pullTheoreticalByBatch is the internal implementation used by both auto and manual pulls
func (s *service) pullTheoreticalByBatch(ctx context.Context, sessionID, journalBatch string) error {
	lines, err := s.lsClient.GetWorksheetLines(ctx, journalBatch)
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
	sess, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}
	if strVal(sess.WorksheetNo) == "" {
		return fmt.Errorf("no worksheet linked to this session")
	}

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

	var finalLines []ls.FinalCountLine
	for _, r := range results {
		finalLines = append(finalLines, ls.FinalCountLine{
			ItemNo:     r.ItemNo,
			CountedQty: r.TotalQty,
		})
	}

	if err := s.lsClient.PostFinalCounts(ctx, strVal(sess.WorksheetNo), finalLines); err != nil {
		return err
	}
	return s.UpdateStatus(ctx, sessionID, StatusSubmitted)
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
		Assign(SessionCounter{Active: true}).
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