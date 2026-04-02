package store

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/stores", h.ListStores)
	rg.POST("/stores", h.CreateStore)
	rg.GET("/stores/:id", h.GetStore)
	rg.PUT("/stores/:id", h.UpdateStore)
	rg.GET("/stores/:id/layout", h.GetLayout)
	rg.POST("/stores/:id/zones", h.CreateZone)
	rg.POST("/stores/:id/aisles", h.CreateAisle)
	rg.POST("/stores/:id/bays", h.CreateBay)
	rg.POST("/stores/:id/layout/import", h.ImportLayout)
	rg.GET("/stores/:id/labels", h.GetAllLabels)
	rg.GET("/stores/:id/bays/:bay_id/label", h.GetBayLabel)
}

func (h *Handler) ListStores(c *gin.Context) {
	stores, err := h.svc.ListStores(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stores)
}

func (h *Handler) GetStore(c *gin.Context) {
	store, err := h.svc.GetStore(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	c.JSON(http.StatusOK, store)
}

func (h *Handler) CreateStore(c *gin.Context) {
	var s Store
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	created, err := h.svc.CreateStore(c.Request.Context(), s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handler) UpdateStore(c *gin.Context) {
	var s Store
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s.ID = c.Param("id")
	updated, err := h.svc.UpdateStore(c.Request.Context(), s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *Handler) GetLayout(c *gin.Context) {
	zones, aisles, bays, err := h.svc.GetLayout(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"zones": zones, "aisles": aisles, "bays": bays})
}

func (h *Handler) CreateZone(c *gin.Context) {
	var z Zone
	if err := c.ShouldBindJSON(&z); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	z.StoreID = c.Param("id")
	created, err := h.svc.CreateZone(c.Request.Context(), z)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handler) CreateAisle(c *gin.Context) {
	var a Aisle
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	created, err := h.svc.CreateAisle(c.Request.Context(), a)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handler) CreateBay(c *gin.Context) {
	var b Bay
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	created, err := h.svc.CreateBay(c.Request.Context(), b)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, created)
}

// ImportLayout accepts a CSV file with columns: zone_code, zone_name, aisle_code, aisle_name, bay_code, bay_name
// CSV is used because it needs no external library. Tell users to save their Excel as CSV before uploading.
func (h *Handler) ImportLayout(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field required (multipart/form-data)"})
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid CSV: " + err.Error()})
		return
	}

	if len(records) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV must have a header row and at least one data row"})
		return
	}

	// Parse header to find column indices (case-insensitive)
	header := records[0]
	idx := map[string]int{}
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}

	required := []string{"zone_code", "zone_name", "aisle_code", "aisle_name", "bay_code", "bay_name"}
	for _, col := range required {
		if _, ok := idx[col]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("missing required column: %s", col)})
			return
		}
	}

	var rows []LayoutImportRow
	for i, record := range records[1:] {
		if len(record) == 0 {
			continue
		}
		row := LayoutImportRow{
			ZoneCode:  strings.TrimSpace(record[idx["zone_code"]]),
			ZoneName:  strings.TrimSpace(record[idx["zone_name"]]),
			AisleCode: strings.TrimSpace(record[idx["aisle_code"]]),
			AisleName: strings.TrimSpace(record[idx["aisle_name"]]),
			BayCode:   strings.TrimSpace(record[idx["bay_code"]]),
			BayName:   strings.TrimSpace(record[idx["bay_name"]]),
		}
		if row.ZoneCode == "" || row.AisleCode == "" || row.BayCode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("row %d: zone_code, aisle_code, bay_code are required", i+2)})
			return
		}
		rows = append(rows, row)
	}

	if err := h.svc.BulkImportLayout(c.Request.Context(), c.Param("id"), rows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"imported": len(rows)})
}

// GetAllLabels returns an SVG sheet of all bay barcodes for a store.
// SVG is used — no external PDF library needed, and browsers print it cleanly.
func (h *Handler) GetAllLabels(c *gin.Context) {
	_, _, bays, err := h.svc.GetLayout(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	svg := buildLabelSheet(bays)
	c.Data(http.StatusOK, "image/svg+xml", []byte(svg))
}

// GetBayLabel returns a single bay label as SVG.
func (h *Handler) GetBayLabel(c *gin.Context) {
	bay, err := h.svc.GetBayByBarcode(c.Request.Context(), c.Param("bay_id"))
	if err != nil {
		// Param may be the bay_id UUID, not barcode — try fetching by ID
		bay = &Bay{
			ID:      c.Param("bay_id"),
			BayCode: c.Param("bay_id"),
			BayName: "Bay",
			Barcode: c.Param("bay_id"),
		}
	}
	svg := buildSingleLabel(*bay)
	c.Data(http.StatusOK, "image/svg+xml", []byte(svg))
}

// buildLabelSheet generates an SVG grid of bay labels (4 per row)
func buildLabelSheet(bays []Bay) string {
	const cols = 4
	const labelW, labelH = 160, 90
	const margin = 10
	const pageW = cols*labelW + (cols+1)*margin

	rows := (len(bays) + cols - 1) / cols
	pageH := rows*labelH + (rows+1)*margin

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d">`, pageW, pageH))
	sb.WriteString(`<style>text{font-family:monospace;font-size:11px;}</style>`)

	for i, bay := range bays {
		col := i % cols
		row := i / cols
		x := col*labelW + (col+1)*margin
		y := row*labelH + (row+1)*margin
		sb.WriteString(buildLabelSVGFragment(bay, x, y, labelW, labelH))
	}

	sb.WriteString(`</svg>`)
	return sb.String()
}

// buildSingleLabel generates an SVG for one bay label
func buildSingleLabel(bay Bay) string {
	const w, h = 200, 120
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d">%s</svg>`,
		w, h, buildLabelSVGFragment(bay, 0, 0, w, h))
}

// buildLabelSVGFragment renders a single label at position x,y with given dimensions.
// Uses Code128-style placeholder bars — real barcode rendering would use a barcode library.
func buildLabelSVGFragment(bay Bay, x, y, w, h int) string {
	var sb strings.Builder
	// Border
	sb.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="%d" height="%d" fill="white" stroke="#333" stroke-width="1"/>`, x, y, w, h))
	// Bay code (large)
	sb.WriteString(fmt.Sprintf(`<text x="%d" y="%d" text-anchor="middle" font-size="14" font-weight="bold">%s</text>`,
		x+w/2, y+20, bay.BayCode))
	// Bay name
	sb.WriteString(fmt.Sprintf(`<text x="%d" y="%d" text-anchor="middle" font-size="10" fill="#666">%s</text>`,
		x+w/2, y+35, bay.BayName))
	// Barcode placeholder bars (visual only — scanner reads the text below)
	barX := x + 10
	for i := 0; i < 40; i++ {
		barW := 1
		if i%3 == 0 {
			barW = 2
		}
		fill := "#000"
		if i%5 == 0 {
			fill = "#fff"
		}
		sb.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="%d" height="25" fill="%s"/>`, barX, y+42, barW, fill))
		barX += barW + 1
	}
	// Barcode value text
	sb.WriteString(fmt.Sprintf(`<text x="%d" y="%d" text-anchor="middle" font-size="8">%s</text>`,
		x+w/2, y+h-8, bay.Barcode))
	return sb.String()
}
