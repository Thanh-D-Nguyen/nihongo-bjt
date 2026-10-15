package email

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strings"
	"testing"
	"time"
)

func TestPasswordResetDeliveryGeneratesLocalizedLink(t *testing.T) {
	tests := []struct {
		locale string
		path   string
		copy   string
	}{
		{locale: "en", path: "/en/reset-password#token=opaque", copy: "Use this link to reset your KotobaWorks password."},
		{locale: "vi", path: "/vi/reset-password#token=opaque", copy: "Dùng liên kết này để đặt lại mật khẩu KotobaWorks."},
		{locale: "ja", path: "/ja/reset-password#token=opaque", copy: "次のリンクから KotobaWorks のパスワードを再設定してください。"},
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	messages := make(chan string, len(tests))
	serverDone := make(chan struct{})
	go func() {
		defer close(serverDone)
		for range tests {
			conn, acceptErr := listener.Accept()
			if acceptErr != nil {
				return
			}
			_, _ = fmt.Fprint(conn, "220 local SMTP\r\n")
			reader := bufio.NewReader(conn)
			for {
				line, readErr := reader.ReadString('\n')
				if readErr != nil {
					_ = conn.Close()
					break
				}
				switch {
				case strings.HasPrefix(line, "EHLO "):
					_, _ = fmt.Fprint(conn, "250-localhost\r\n250 SIZE 1000000\r\n")
				case strings.HasPrefix(line, "MAIL FROM:") || strings.HasPrefix(line, "RCPT TO:"):
					_, _ = fmt.Fprint(conn, "250 ok\r\n")
				case strings.HasPrefix(line, "DATA"):
					_, _ = fmt.Fprint(conn, "354 send data\r\n")
					var message strings.Builder
					for {
						bodyLine, bodyErr := reader.ReadString('\n')
						if bodyErr != nil {
							_ = conn.Close()
							break
						}
						if bodyLine == ".\r\n" {
							messages <- message.String()
							_, _ = fmt.Fprint(conn, "250 queued\r\n")
							break
						}
						message.WriteString(bodyLine)
					}
				case strings.HasPrefix(line, "QUIT"):
					_, _ = fmt.Fprint(conn, "221 bye\r\n")
					_ = conn.Close()
					goto nextConnection
				}
			}
		nextConnection:
		}
	}()

	sender, err := NewSMTP(listener.Addr().String(), "no-reply@example.com", "", "", "https://example.com", false)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range tests {
		if err := sender.SendPasswordReset(context.Background(), "learner@example.com", "opaque", test.locale); err != nil {
			t.Fatal(err)
		}
	}
	if err := sender.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	<-serverDone
	generated := make([]string, 0, len(tests))
	for range tests {
		generated = append(generated, <-messages)
	}
	for _, test := range tests {
		found := false
		for _, message := range generated {
			if strings.Contains(message, test.copy) && strings.Contains(message, "https://example.com"+test.path) {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("locale %q must produce localized message and reset URL", test.locale)
		}
	}
}

func TestSMTPRejectsInsecureExternalResetURL(t *testing.T) {
	if _, err := NewSMTP("127.0.0.1:1025", "no-reply@example.com", "", "", "http://example.com", false); err == nil {
		t.Fatal("external reset URL must use HTTPS")
	}
}

func TestSMTPRequiresSTARTTLSForRemoteConfiguration(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = fmt.Fprint(conn, "220 local test SMTP\r\n")
		reader := bufio.NewReader(conn)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			if strings.HasPrefix(line, "EHLO ") {
				_, _ = fmt.Fprint(conn, "250-localhost\r\n250 SIZE 1000000\r\n")
			} else if strings.HasPrefix(line, "QUIT") {
				_, _ = fmt.Fprint(conn, "221 bye\r\n")
				return
			}
		}
	}()

	sender, err := NewSMTP(listener.Addr().String(), "no-reply@example.com", "", "", "https://example.com", true)
	if err != nil {
		t.Fatal(err)
	}
	if err := sender.SendPasswordReset(context.Background(), "learner@example.com", "opaque-token", "en"); err == nil || !strings.Contains(err.Error(), "does not support required STARTTLS") {
		t.Fatalf("expected missing STARTTLS delivery error, got %v", err)
	}
	if err := sender.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestSMTPRejectsPartialCredentialsAndSendsAfterClose(t *testing.T) {
	if _, err := NewSMTP("127.0.0.1:1025", "no-reply@example.com", "user", "", "http://localhost", false); err == nil {
		t.Fatal("expected partial SMTP credentials to be rejected")
	}
	sender, err := NewSMTP("127.0.0.1:1025", "no-reply@example.com", "", "", "http://localhost", false)
	if err != nil {
		t.Fatal(err)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err := sender.SendPasswordReset(canceled, "learner@example.com", "opaque-token", "en"); err != context.Canceled {
		t.Fatalf("canceled send must return context.Canceled, got %v", err)
	}
	if err := sender.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := sender.SendPasswordReset(context.Background(), "learner@example.com", "opaque-token", "en"); err == nil {
		t.Fatal("send after close must return an error")
	}
}

func TestSMTPServerRejectionDoesNotLogResetToken(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	const token = "opaque-reset-token-that-must-not-leak"
	serverDone := make(chan struct{})
	linkIsFragment := make(chan bool, 1)
	go func() {
		defer close(serverDone)
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
		_, _ = fmt.Fprint(conn, "220 test SMTP\r\n")
		reader := bufio.NewReader(conn)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			switch {
			case strings.HasPrefix(line, "EHLO "):
				_, _ = fmt.Fprint(conn, "250-localhost\r\n250 SIZE 1000000\r\n")
			case strings.HasPrefix(line, "MAIL FROM:") || strings.HasPrefix(line, "RCPT TO:"):
				_, _ = fmt.Fprint(conn, "250 ok\r\n")
			case strings.HasPrefix(line, "DATA"):
				_, _ = fmt.Fprint(conn, "354 send data\r\n")
				var message strings.Builder
				for {
					bodyLine, readErr := reader.ReadString('\n')
					if readErr != nil {
						return
					}
					if bodyLine == ".\r\n" {
						body := message.String()
						linkIsFragment <- strings.Contains(body, "#token="+token) && !strings.Contains(body, "?token=")
						_, _ = fmt.Fprintf(conn, "550 rejected token=%s\r\n", token)
						return
					}
					message.WriteString(bodyLine)
				}
			case strings.HasPrefix(line, "QUIT"):
				_, _ = fmt.Fprint(conn, "221 bye\r\n")
				return
			}
		}
	}()

	sender, err := NewSMTP(listener.Addr().String(), "no-reply@example.com", "", "", "http://localhost", false)
	if err != nil {
		t.Fatal(err)
	}
	deliveryErr := sender.SendPasswordReset(context.Background(), "learner@example.com", token, "en")
	if deliveryErr == nil || !strings.Contains(deliveryErr.Error(), "SMTP message delivery was rejected") {
		t.Fatalf("expected actual SMTP rejection from SendPasswordReset, got %v", deliveryErr)
	}
	if err := sender.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	<-serverDone
	if !<-linkIsFragment {
		t.Fatal("reset email must keep the bearer token out of the HTTP request URL")
	}
	if strings.Contains(deliveryErr.Error(), token) {
		t.Fatal("SMTP server rejection must not expose reset links or tokens in errors")
	}
}
