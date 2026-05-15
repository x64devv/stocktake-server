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

// CounterSessionView is a richer session response for the mobile counter app.
type CounterSessionView struct {
	ID           string        `json:"id"`
	StoreID      string        `json:"store_id"`
	StoreName    string        `json:"store_name"`
	SessionDate  string        `json:"session_date"`
	Type         SessionType   `json:"type"`
	Status       SessionStatus `json:"status"`
	BaysTotal    int           `json:"bays_total"`
	BaysComplete int           `json:"bays_complete"`
}

// BayView is a flattened bay record with zone/aisle context for the mobile app.
type BayView struct {
	ID        string `json:"id"`
	ZoneCode  string `json:"zone_code"`
	ZoneName  string `json:"zone_name"`
	AisleCode string `json:"aisle_code"`
	AisleName string `json:"aisle_name"`
	BayCode   string `json:"bay_code"`
	BayName   string `json:"bay_name"`
	Barcode   string `json:"barcode"`
	Submitted bool   `json:"submitted"`
}

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
	// Counter-specific methods (used by the mobile app)
	GetCounterSessionViews(ctx context.Context, counterID string) ([]CounterSessionView, error)
	GetCounterSessionView(ctx context.Context, sessionID, counterID string) (*CounterSessionView, error)
	GetSessionBays(ctx context.Context, sessionID, counterID string) ([]BayView, error)
	GetSessionItemByBarcode(ctx context.Context, sessionID, barcode string) (*SessionItem, error)
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

// pullTheoreticalBySeqNo fetches lines from LS and upserts theoretical stock records.
// It also populates SessionItems so the mobile app can look up items by barcode.
func (s *service) pullTheoreticalBySeqNo(ctx context.Context, sessionID string, worksheetSeqNo int) error {
	lines, err := s.lsClient.GetWorksheetLines(ctx, worksheetSeqNo)
	if err != nil {
		return fmt.Errorf("fetch LS worksheet: %w", err)
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Clear and repopulate TheoreticalStock
		tx.Where("session_id = ?", sessionID).Delete(&TheoreticalStock{})
		// Clear and repopulate SessionItems (barcode/description/uom for mobile lookup)
		tx.Where("session_id = ?", sessionID).Delete(&SessionItem{})

		for _, line := range lines {
			if err := tx.Create(&TheoreticalStock{
				SessionID:      sessionID,
				ItemNo:         line.ItemNo,
				TheoreticalQty: line.TheoreticalQty,
				UnitCost:       line.UnitCost,
			}).Error; err != nil {
				return err
			}
			if err := tx.Create(&SessionItem{
				SessionID:   sessionID,
				ItemNo:      line.ItemNo,
				Description: line.Description,
				Barcode:     line.Barcode,
				UoM:         line.UoM,
				UnitCost:    line.UnitCost,
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

// GetCounterSessionViews returns rich session summaries for the mobile counter app,
// including store name and bay completion progress.
func (s *service) GetCounterSessionViews(ctx context.Context, counterID string) ([]CounterSessionView, error) {
	sessions, err := s.GetCounterSessions(ctx, counterID)
	if err != nil {
		return nil, err
	}
	views := make([]CounterSessionView, 0, len(sessions))
	for _, sess := range sessions {
		view, err := s.buildSessionView(ctx, sess, counterID)
		if err != nil {
			continue
		}
		views = append(views, *view)
	}
	return views, nil
}

// GetCounterSessionView returns a single rich session view for the mobile counter app.
func (s *service) GetCounterSessionView(ctx context.Context, sessionID, counterID string) (*CounterSessionView, error) {
	sess, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return s.buildSessionView(ctx, *sess, counterID)
}

// buildSessionView enriches a Session with store name and bay completion counts.
func (s *service) buildSessionView(ctx context.Context, sess Session, counterID string) (*CounterSessionView, error) {
	// Get store name
	type storeRow struct{ StoreName string }
	var sr storeRow
	s.db.WithContext(ctx).Raw("SELECT store_name FROM stores WHERE id = ?", sess.StoreID).Scan(&sr)

	// Count total bays in this store
	var baysTotal int64
	s.db.WithContext(ctx).Raw(`
		SELECT COUNT(b.id)
		FROM bays b
		JOIN aisles a ON a.id = b.aisle_id
		JOIN zones z ON z.id = a.zone_id
		WHERE z.store_id = ? AND b.active = true`, sess.StoreID).Scan(&baysTotal)

	// Count submitted bays for this session by this counter
	var baysComplete int64
	s.db.WithContext(ctx).Raw(`
		SELECT COUNT(DISTINCT bay_id)
		FROM bin_submissions
		WHERE session_id = ? AND counter_id = ?`, sess.ID, counterID).Scan(&baysComplete)

	return &CounterSessionView{
		ID:           sess.ID,
		StoreID:      sess.StoreID,
		StoreName:    sr.StoreName,
		SessionDate:  sess.SessionDate,
		Type:         sess.Type,
		Status:       sess.Status,
		BaysTotal:    int(baysTotal),
		BaysComplete: int(baysComplete),
	}, nil
}

// GetSessionBays returns all bays for the store associated with a session,
// tagged with whether this counter has submitted each bay.
func (s *service) GetSessionBays(ctx context.Context, sessionID, counterID string) ([]BayView, error) {
	sess, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	type rawBay struct {
		ID        string
		ZoneCode  string
		ZoneName  string
		AisleCode string
		AisleName string
		BayCode   string
		BayName   string
		Barcode   string
	}
	var rawBays []rawBay
	if err := s.db.WithContext(ctx).Raw(`
		SELECT b.id, z.zone_code, z.zone_name, a.aisle_code, a.aisle_name,
		       b.bay_code, b.bay_name, b.barcode
		FROM bays b
		JOIN aisles a ON a.id = b.aisle_id
		JOIN zones z ON z.id = a.zone_id
		WHERE z.store_id = ? AND b.active = true
		ORDER BY z.zone_code, a.aisle_code, b.bay_code`, sess.StoreID).Scan(&rawBays).Error; err != nil {
		return nil, err
	}

	// Collect submitted bay IDs for this session + counter
	var submittedIDs []string
	s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT bay_id FROM bin_submissions
		WHERE session_id = ? AND counter_id = ?`, sessionID, counterID).
		Scan(&submittedIDs)
	submittedSet := make(map[string]bool, len(submittedIDs))
	for _, id := range submittedIDs {
		submittedSet[id] = true
	}

	views := make([]BayView, 0, len(rawBays))
	for _, b := range rawBays {
		views = append(views, BayView{
			ID:        b.ID,
			ZoneCode:  b.ZoneCode,
			ZoneName:  b.ZoneName,
			AisleCode: b.AisleCode,
			AisleName: b.AisleName,
			BayCode:   b.BayCode,
			BayName:   b.BayName,
			Barcode:   b.Barcode,
			Submitted: submittedSet[b.ID],
		})
	}
	return views, nil
}

// GetSessionItemByBarcode looks up a session item by barcode within a session.
// Returns the SessionItem populated during theoretical stock pull.
func (s *service) GetSessionItemByBarcode(ctx context.Context, sessionID, barcode string) (*SessionItem, error) {
	var item SessionItem
	err := s.db.WithContext(ctx).
		Where("session_id = ? AND barcode = ?", sessionID, barcode).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}