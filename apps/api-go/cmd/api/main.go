// Package main is the entry point for the KotobaWork Go API service.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/app"
)

// version is set at build time via -ldflags.
var version = "dev"

func main() {
	a, err := app.New(version)
	if err != nil {
		slog.Error("failed to initialize application", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	go func() {
		if err := a.Server.Start(); err != nil {
			a.Logger.Error("HTTP server error", "error", err)
			stop()
		}
	}()

	a.Logger.Info("application started", "version", version, "port", a.Config.Port)

	<-ctx.Done()
	a.Logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), a.Config.ShutdownTimeout)
	defer cancel()

	a.Shutdown(shutdownCtx)
}
