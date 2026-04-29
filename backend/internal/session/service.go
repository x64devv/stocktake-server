package session

import (
	"context"
	"fmt"
	"strconv"

	"github.com/totalretail/stocktake/internal/auth"
	"github.com/totalretail/stocktake/internal/ls"
	"github.com/totalretail/stocktake/internal/ws"
	"gorm.io/gorm"
)

type Service interface {
	ListSessions(ctx context.Context, storeID string) ([]Session, error)
	GetSession(ctx context.Context, id string) (*Session, error)
	CreateSession(ctx context.Context, s Session) (*Session, error)
	UpdateSession(ctx context.Context, id string, worksheetSeqNo int) (*Session, error)
	UpdateStatus(ctx context.Context, id string, status SessionStatus) error
	AddCounter(ctx context.Context, sessionID, counterID string) error
	RemoveCounter(ctx context.Context, sessionID, counterID string) error
	PullTheoretical(ctx context.Context, sessionID string) error
	SubmitToLS(ctx context.Context, sessionID string) error
	UpsertCounter(ctx context.Context, name, mobile string) (*auth.Counter, error)
	ListCounters(ctx context.Context, sessionID string) ([]auth.Counter, error)
	GetCounterSessions(ctx context.Context, counterID string) ([]Session, error)
	GetAvailableWorksheets(ctx context.Context) ([]ls.AvailableWorksheet, error)
	GetLSStores(ctx context.Context) ([]ls.LSStore, error)
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

// worksheetSeqNoFromSession parses the stored worksheet_no string back to int.
// Returns 0 if nil or unparseable.
func worksheetSeqNoFromSession(sess *Session) int {
	if sess.WorksheetNo == nil {
		return 0
	}
	n, err := strconv.Atoi(*sess.WorksheetNo)
	if err != nil {
		return 0
	}
	return n
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
	if seqNo := worksheetSeqNoFromSession(&sess); seqNo > 0 {
		if err := s.pullTheoreticalBySeqNo(ctx, sess.ID, seqNo); err != nil {
			// Non-fatal — log and continue
			_ = err
		}
	}

	return &sess, nil
}

// UpdateSession updates the linked worksheet (stored as string) and re-pulls theoreticals
func (s *service) UpdateSession(ctx context.Context, id string, worksheetSeqNo int) (*Session, error) {
	var worksheetNoStr *string
	if worksheetSeqNo > 0 {
		str := strconv.Itoa(worksheetSeqNo)
		worksheetNoStr = &str
	}

	if err := s.db.WithContext(ctx).Model(&Session{}).
		Where("id = ?", id).
		Update("worksheet_no", worksheetNoStr).Error; err != nil {
		return nil, err
	}

	if worksheetSeqNo > 0 {
		if err := s.pullTheoreticalBySeqNo(ctx, id, worksheetSeqNo); err != nil {
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

func (s *service) GetLSStores(ctx context.Context) ([]ls.LSStore, error) {
	return s.lsClient.GetLSStores(ctx)
}

// PullTheoretical is the manual trigger — uses the session's stored worksheet_no
func (s *service) PullTheoretical(ctx context.Context, sessionID string) error {
	sess, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}
	seqNo := worksheetSeqNoFromSession(sess)
	if seqNo == 0 {
		return fmt.Errorf("no worksheet linked to this session — set a worksheet first")
	}
	return s.pullTheoreticalBySeqNo(ctx, sessionID, seqNo)
}

// pullTheoreticalBySeqNo fetches lines from LS and upserts theoretical stock records
func (s *service) pullTheoreticalBySeqNo(ctx context.Context, sessionID string, worksheetSeqNo int) error {
	lines, err := s.lsClient.GetWorksheetLines(ctx, worksheetSeqNo)
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
	seqNo := worksheetSeqNoFromSession(sess)
	if seqNo == 0 {
		return fmt.Errorf("no worksheet linked to this session")
	}

	// Fetch worksheet lines so we have LineNo for each item
	wsLines, err := s.lsClient.GetWorksheetLines(ctx, seqNo)
	if err != nil {
		return fmt.Errorf("fetch worksheet lines for submit: %w", err)
	}
	lineNoByItem := make(map[string]int, len(wsLines))
	for _, l := range wsLines {
		lineNoByItem[l.ItemNo] = l.LineNo
	}

	// Use accepted counts (latest round, accepted variance flags respected)
	type result struct {
		ItemNo   string
		TotalQty float64
	}
	var results []result
	if err := s.db.WithContext(ctx).Raw(`
		SELECT item_no, COALESCE(SUM(quantity), 0) AS total_qty
		FROM count_lines
		WHERE session_id = ?
		AND round_no = (
			SELECT MAX(round_no) FROM count_lines cl2
			WHERE cl2.session_id = count_lines.session_id AND cl2.item_no = count_lines.item_no
		)
		GROUP BY item_no`, sessionID).Scan(&results).Error; err != nil {
		return err
	}

	var finalLines []ls.FinalCountLine
	for _, r := range results {
		lineNo, ok := lineNoByItem[r.ItemNo]
		if !ok {
			continue // item not in this worksheet — skip
		}
		finalLines = append(finalLines, ls.FinalCountLine{
			ItemNo:     r.ItemNo,
			LineNo:     lineNo,
			CountedQty: r.TotalQty,
		})
	}

	if err := s.lsClient.PostFinalCounts(ctx, seqNo, finalLines); err != nil {
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