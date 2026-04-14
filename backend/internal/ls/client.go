package ls

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// WorksheetLine is used when pulling theoretical stock from LS
type WorksheetLine struct {
	ItemNo         string  `json:"Item_No"`
	Description    string  `json:"Description"`
	TheoreticalQty float64 `json:"Qty_Calculated"`
	UoM            string  `json:"Unit_of_Measure_Code"`
}

// ItemLine is used when pulling the item master from LS
type ItemLine struct {
	ItemNo      string `json:"No"`
	Description string `json:"Description"`
	Barcode     string `json:"Barcode"`
	UoM         string `json:"BaseUnitOfMeasure"`
}

// physInventoryKey holds the composite key needed to PATCH a journal line
type physInventoryKey struct {
	JournalTemplateName string  `json:"Journal_Template_Name"`
	JournalBatchName    string  `json:"Journal_Batch_Name"`
	LineNo              int     `json:"Line_No"`
	ItemNo              string  `json:"Item_No"`
	QtyCalculated       float64 `json:"Qty_Calculated"`
	ETag                string  `json:"-"` // populated from @odata.etag
}

// FinalCountLine is the payload for PostFinalCounts
type FinalCountLine struct {
	ItemNo      string
	CountedQty  float64
}

type Client struct {
	baseURL   string
	company   string
	username  string
	password  string
	http      *http.Client
}

func NewClient(baseURL, company, username, password string) *Client {
	return &Client{
		baseURL:  baseURL,
		company:  company,
		username: username,
		password: password,
		http:     &http.Client{},
	}
}

func (c *Client) oDataURL(entity string) string {
	return fmt.Sprintf("%s/ODataV4/Company('%s')/%s",
		c.baseURL, url.PathEscape(c.company), entity)
}

// GetWorksheetLines fetches physical inventory journal lines from BC for a given journal batch
func (c *Client) GetWorksheetLines(ctx context.Context, journalBatch string) ([]WorksheetLine, error) {
	filter := fmt.Sprintf("Journal_Batch_Name eq '%s'", journalBatch)
	endpoint := fmt.Sprintf("%s?$filter=%s&$format=json",
		c.oDataURL("PhysInventoryJournal"), url.QueryEscape(filter))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LS worksheet request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LS returned %d fetching worksheet", resp.StatusCode)
	}

	var result struct {
		Value []WorksheetLine `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode worksheet response: %w", err)
	}
	return result.Value, nil
}

// PostFinalCounts patches Qty_Phys_Inventory on each matching journal line in BC
func (c *Client) PostFinalCounts(ctx context.Context, journalBatch string, lines []FinalCountLine) error {
	// Step 1: fetch existing journal lines to get composite keys and ETags
	filter := fmt.Sprintf("Journal_Batch_Name eq '%s'", journalBatch)
	endpoint := fmt.Sprintf("%s?$filter=%s&$format=json",
		c.oDataURL("PhysInventoryJournal"), url.QueryEscape(filter))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("fetch journal lines: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("LS returned %d fetching journal lines", resp.StatusCode)
	}

	// decode as raw map to capture @odata.etag
	var raw struct {
		Value []map[string]interface{} `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return fmt.Errorf("decode journal lines: %w", err)
	}

	// index by ItemNo for quick lookup
	keysByItem := make(map[string]physInventoryKey)
	for _, entry := range raw.Value {
		itemNo, _ := entry["Item_No"].(string)
		if itemNo == "" {
			continue
		}
		templateName, _ := entry["Journal_Template_Name"].(string)
		batchName, _ := entry["Journal_Batch_Name"].(string)
		lineNoFloat, _ := entry["Line_No"].(float64)
		etag, _ := entry["@odata.etag"].(string)
		qtyCalc, _ := entry["Qty_Calculated"].(float64)

		keysByItem[itemNo] = physInventoryKey{
			JournalTemplateName: templateName,
			JournalBatchName:    batchName,
			LineNo:              int(lineNoFloat),
			ItemNo:              itemNo,
			QtyCalculated:       qtyCalc,
			ETag:                etag,
		}
	}

	// Step 2: PATCH each line with counted quantity
	for _, line := range lines {
		key, ok := keysByItem[line.ItemNo]
		if !ok {
			// item not in journal — skip (could log a warning)
			continue
		}

		patchURL := fmt.Sprintf("%s(Journal_Template_Name='%s',Journal_Batch_Name='%s',Line_No=%d)",
			c.oDataURL("PhysInventoryJournal"),
			url.PathEscape(key.JournalTemplateName),
			url.PathEscape(key.JournalBatchName),
			key.LineNo,
		)

		body, err := json.Marshal(map[string]interface{}{
			"Qty_Phys_Inventory": line.CountedQty,
		})
		if err != nil {
			return fmt.Errorf("marshal patch body for %s: %w", line.ItemNo, err)
		}

		patchReq, err := http.NewRequestWithContext(ctx, http.MethodPatch, patchURL, bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("create patch request for %s: %w", line.ItemNo, err)
		}
		patchReq.SetBasicAuth(c.username, c.password)
		patchReq.Header.Set("Content-Type", "application/json")
		patchReq.Header.Set("Accept", "application/json")
		if key.ETag != "" {
			patchReq.Header.Set("If-Match", key.ETag)
		} else {
			patchReq.Header.Set("If-Match", "*")
		}

		patchResp, err := c.http.Do(patchReq)
		if err != nil {
			return fmt.Errorf("patch item %s: %w", line.ItemNo, err)
		}
		patchResp.Body.Close()

		if patchResp.StatusCode != http.StatusNoContent && patchResp.StatusCode != http.StatusOK {
			return fmt.Errorf("patch item %s: BC returned %d", line.ItemNo, patchResp.StatusCode)
		}
	}

	return nil
}

// GetItems fetches the item master from LS
func (c *Client) GetItems(ctx context.Context) ([]ItemLine, error) {
	endpoint := fmt.Sprintf("%s?$format=json&$select=No,Description,Barcode,BaseUnitOfMeasure",
		c.oDataURL("Item"))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
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

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LS returned %d fetching items", resp.StatusCode)
	}

	var result struct {
		Value []ItemLine `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode items response: %w", err)
	}
	return result.Value, nil
}

// AvailableWorksheet represents a physical inventory journal batch in BC
type AvailableWorksheet struct {
	JournalTemplateName string `json:"journal_template_name"`
	JournalBatchName    string `json:"journal_batch_name"`
}

// GetAvailableWorksheets returns all distinct journal batches that have phys inventory lines
func (c *Client) GetAvailableWorksheets(ctx context.Context) ([]AvailableWorksheet, error) {
	endpoint := fmt.Sprintf("%s?$format=json&$select=Journal_Template_Name,Journal_Batch_Name",
		c.oDataURL("PhysInventoryJournal"))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(c.username, c.password)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch worksheets: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LS returned %d fetching worksheets", resp.StatusCode)
	}

	var result struct {
		Value []struct {
			JournalTemplateName string `json:"Journal_Template_Name"`
			JournalBatchName    string `json:"Journal_Batch_Name"`
		} `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode worksheets: %w", err)
	}

	// deduplicate by batch name
	seen := make(map[string]bool)
	var out []AvailableWorksheet
	for _, v := range result.Value {
		key := v.JournalTemplateName + "|" + v.JournalBatchName
		if !seen[key] {
			seen[key] = true
			out = append(out, AvailableWorksheet{
				JournalTemplateName: v.JournalTemplateName,
				JournalBatchName:    v.JournalBatchName,
			})
		}
	}
	return out, nil
}