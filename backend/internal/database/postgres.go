package database

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

type Postgres struct {
	sql *sql.DB
}

func OpenAndMigrate(ctx context.Context, dsn string) (*Postgres, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	if _, err := conn.ExecContext(ctx, schemaSQL); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("run schema migration: %w", err)
	}

	return &Postgres{sql: conn}, nil
}

func (p *Postgres) SQL() *sql.DB {
	return p.sql
}

func (p *Postgres) Close() error {
	if p == nil || p.sql == nil {
		return nil
	}
	return p.sql.Close()
}
