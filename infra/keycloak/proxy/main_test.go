package main

import (
  "net/http"
  "net/http/httptest"
  "strings"
  "testing"
  "time"
)

func TestProxyPreservesResponseAndAuthorization(t *testing.T) {
  upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Header.Get("Authorization") != "Bearer test" || r.URL.Path != "/realms/lab" { t.Error("request not preserved") }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(401)
    w.Write([]byte(`{"error":"unauthorized"}`))
  }))
  defer upstream.Close()
  recorder := httptest.NewRecorder()
  request := httptest.NewRequest("GET", "https://auth.example/realms/lab", nil)
  request.Header.Set("Authorization", "Bearer test")
  handler(strings.TrimPrefix(upstream.URL, "http://"), time.Second).ServeHTTP(recorder, request)
  if recorder.Code != 401 || recorder.Body.String() != `{"error":"unauthorized"}` { t.Fatal("upstream response changed") }
}
func TestStartingServiceReturnsRetryInsteadOfSuccessfulLogin(t *testing.T) {
  recorder := httptest.NewRecorder()
  handler("127.0.0.1:1", 20*time.Millisecond).ServeHTTP(recorder, httptest.NewRequest("GET", "/", nil))
  if recorder.Code != 503 || recorder.Header().Get("Retry-After") != "3" { t.Fatal("must return honest startup status") }
}
