package main

import (
	"log"

	"github.com/totalretail/stocktake/internal/config"
	"github.com/totalretail/stocktake/internal/counting"
	"github.com/totalretail/stocktake/internal/db"
	"github.com/totalretail/stocktake/internal/server"
	"github.com/totalretail/stocktake/internal/session"
	"github.com/totalretail/stocktake/internal/store"
	"github.com/totalretail/stocktake/internal/variance"
	"github.com/totalretail/stocktake/internal/auth"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Enable uuid-ossp for gen_random_uuid()
	database.Exec("CREATE EXTENSION IF NOT EXISTS pgcrypto")

	// AutoMigrate all models
	if err := database.AutoMigrate(
		&store.Store{},
		&store.Zone{},
		&store.Aisle{},
		&store.Bay{},
		&auth.AdminUser{},
		&auth.Counter{},
		&session.Session{},
		&session.SessionItem{},
		&session.SessionCounter{},
		&session.TheoreticalStock{},
		&counting.CountLine{},
		&counting.BinSubmission{},
		&variance.VarianceFlag{},
		&variance.RecountDecision{},
	); err != nil {
		log.Fatalf("automigrate failed: %v", err)
	}

	// Seed default admin if none exists
	var count int64
	database.Model(&auth.AdminUser{}).Count(&count)
	if count == 0 {
		hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		database.Create(&auth.AdminUser{
			Username:     "admin",
			PasswordHash: string(hash),
			FullName:     "System Administrator",
			Active:       true,
		})
		log.Println("Created default admin user: admin / admin123 — change this password immediately")
	}

	srv := server.New(cfg, database)
	log.Printf("starting stocktake-api on %s", cfg.ServerAddr)
	if err := srv.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}