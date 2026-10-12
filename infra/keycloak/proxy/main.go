// The HTTP listener starts immediately while Keycloak warms up. Vercel's
// container startup timeout is shorter than the first PostgreSQL migration.
package main

import (
  "context"
  "errors"
  "log"
  "net"
  "net/http"
  "net/http/httputil"
  "net/url"
  "os"
  "os/exec"
  "os/signal"
  "syscall"
  "time"
)

func awaitListener(ctx context.Context, address string) bool {
  ticker := time.NewTicker(200 * time.Millisecond)
  defer ticker.Stop()
  for {
    connection, err := (&net.Dialer{Timeout: 500 * time.Millisecond}).DialContext(ctx, "tcp", address)
    if err == nil { connection.Close(); return true }
    select { case <-ctx.Done(): return false; case <-ticker.C: }
  }
}

func handler(address string, wait time.Duration) http.Handler {
  target, _ := url.Parse("http://" + address)
  proxy := httputil.NewSingleHostReverseProxy(target)
  proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
    w.Header().Set("Retry-After", "3")
    http.Error(w, "Sign-in service is starting. Please retry.", http.StatusServiceUnavailable)
  }
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Cache-Control", "no-store")
    ctx, cancel := context.WithTimeout(r.Context(), wait)
    defer cancel()
    if !awaitListener(ctx, address) {
      w.Header().Set("Retry-After", "3")
      http.Error(w, "Sign-in service is starting. Please retry shortly.", http.StatusServiceUnavailable)
      return
    }
    proxy.ServeHTTP(w, r)
  })
}

func main() {
  if len(os.Args) < 2 { log.Fatal("Keycloak startup command is required") }
  command := exec.Command(os.Args[1], os.Args[2:]...)
  command.Stdout, command.Stderr = os.Stdout, os.Stderr
  if err := command.Start(); err != nil { log.Fatal(err) }
  go func() { if err := command.Wait(); err != nil { log.Print("Keycloak process stopped") }; os.Exit(1) }()
  port := os.Getenv("PORT")
  if port == "" { port = "8080" }
  server := &http.Server{Addr: ":" + port, Handler: handler("127.0.0.1:8081", 50*time.Second), ReadHeaderTimeout: 10*time.Second}
  stopped := make(chan os.Signal, 1)
  signal.Notify(stopped, syscall.SIGTERM, syscall.SIGINT)
  go func() { <-stopped; _ = command.Process.Signal(syscall.SIGTERM); ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second); defer cancel(); _ = server.Shutdown(ctx) }()
  log.Print("Auth HTTP listener ready; waiting for Keycloak initialization")
  if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) { log.Fatal(err) }
}
