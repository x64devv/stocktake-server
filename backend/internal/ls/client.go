package ls

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type WorksheetLine struct {
	ItemNo         string  `json:"No"`
	Description    string  `json:"Description"`
	TheoreticalQty float64 `json:"QtyCalculated"`
}

type ItemLine struct {
	ItemNo      string `json:"No"`
	Description string `json:"Description"`
	Barcode     string `json:"Barcode"`
	UoM         string `json:"BaseUnitOfMeasure"`
}

type Client struct {
	baseURL   string
	companyID string
	username  string
	password  string
	http      *http.Client
}

func NewClient(baseURL, companyID, username, password string) *Client {
	return &Client{
		baseURL:   baseURL,
		companyID: companyID,
		username:  username,
		password:  password,
		http:      &http.Client{},
	}
}

// GetWorksheetLines fetches the stock count worksheet for a given LS store/journal batch
func (c *Client) GetWorksheetLines(ctx context.Context, journalBatch string) ([]WorksheetLine, error) {
	url := fmt.Sprintf("%s/v2.0/%s/phys_invt_journal_line?$filter=JournalBatchName eq '%s'&$format=json",
		c.baseURL, c.companyID, journalBatch)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LS request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LS returned %d", resp.StatusCode)
	}

	var result struct {
		Value []WorksheetLine `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Value, nil
}

// PostFinalCounts submits accepted count lines back to LS
func (c *Client) PostFinalCounts(ctx context.Context, journalBatch string, lines []WorksheetLine) error {
	// TODO: implement PATCH/POST to LS phys_invt_journal_line endpoint
	// This depends on the exact LS Commerce Service API for updating quantities
	return fmt.Errorf("PostFinalCounts not yet implemented — confirm LS endpoint first")
}

// GetItems fetches the item master for a store from LS
func (c *Client) GetItems(ctx context.Context) ([]ItemLine, error) {
	url := fmt.Sprintf("%s/v2.0/%s/item?$format=json&$select=No,Description,Barcode,BaseUnitOfMeasure",
		c.baseURL, c.companyID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LS items request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Value []ItemLine `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Value, nil
}
