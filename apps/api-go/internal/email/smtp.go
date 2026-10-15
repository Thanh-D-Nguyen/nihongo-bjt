package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"net/url"
	"strings"
	"sync"
	"time"
)

type SMTP struct {
	Address         string
	From            string
	Username        string
	Password        string
	RequireStartTLS bool
	PublicURL       string
	mu              sync.RWMutex
	closed          bool
}

type message struct{ from, to, content string }

func passwordResetMessage(locale, resetURL string) string {
	subject, instructions, expiry, ignore := "KotobaWorks password reset", "Use this link to reset your KotobaWorks password.", "It expires in one hour:", "If you did not request this, ignore this email."
	switch locale {
	case "vi":
		subject, instructions, expiry, ignore = "Đặt lại mật khẩu KotobaWorks", "Dùng liên kết này để đặt lại mật khẩu KotobaWorks.", "Liên kết sẽ hết hạn sau một giờ:", "Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email."
	case "ja":
		subject, instructions, expiry, ignore = "KotobaWorks パスワード再設定", "次のリンクから KotobaWorks のパスワードを再設定してください。", "このリンクは 1 時間で期限切れになります。", "お心当たりがない場合は、このメールを無視してください。"
	}
	return "Subject: " + mime.QEncoding.Encode("UTF-8", subject) + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + instructions + "\r\n" + expiry + "\r\n" + resetURL + "\r\n\r\n" + ignore + "\r\n"
}

func NewSMTP(address, from, username, password, publicURL string, requireStartTLS bool) (*SMTP, error) {
	if (username == "") != (password == "") {
		return nil, fmt.Errorf("SMTP username and password must both be configured")
	}
	if _, _, err := smtpParts(from, "", publicURL); err != nil {
		return nil, fmt.Errorf("invalid reset email configuration")
	}
	if _, _, err := net.SplitHostPort(address); err != nil {
		return nil, fmt.Errorf("invalid SMTP address")
	}
	return &SMTP{Address: address, From: from, Username: username, Password: password, PublicURL: publicURL, RequireStartTLS: requireStartTLS}, nil
}

func (s *SMTP) SendPasswordReset(ctx context.Context, recipient, token, locale string) error {
	from, to, err := smtpParts(s.From, recipient, s.PublicURL)
	if err != nil {
		return err
	}
	base, _ := url.Parse(s.PublicURL)
	if locale != "vi" && locale != "ja" && locale != "en" {
		locale = "en"
	}
	base.Path = strings.TrimRight(base.Path, "/") + "/" + locale + "/reset-password"
	base.Fragment = "token=" + token
	content := "From: " + from.String() + "\r\nTo: " + to.String() + "\r\n" + passwordResetMessage(locale, base.String())
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.closed {
		return fmt.Errorf("password reset mailer is closed")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return s.send(ctx, message{from: from.Address, to: to.Address, content: content})
}

func smtpParts(sender, recipient, publicURL string) (*mail.Address, *mail.Address, error) {
	from, err := mail.ParseAddress(sender)
	if err != nil || from.Address == "" {
		return nil, nil, fmt.Errorf("invalid sender address")
	}
	base, err := url.Parse(publicURL)
	if err != nil || (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" || base.User != nil || base.RawQuery != "" || base.Fragment != "" {
		return nil, nil, fmt.Errorf("invalid public URL")
	}
	if base.Scheme == "http" {
		host := strings.ToLower(base.Hostname())
		ip := net.ParseIP(host)
		if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return nil, nil, fmt.Errorf("external reset URL must use HTTPS")
		}
	}
	to, err := mail.ParseAddress(recipient)
	if recipient == "" {
		return from, nil, nil
	}
	if err != nil || to.Address == "" {
		return nil, nil, fmt.Errorf("invalid recipient address")
	}
	return from, to, nil
}

func (s *SMTP) Close(_ context.Context) error {
	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()
	return nil
}

func (s *SMTP) send(ctx context.Context, msg message) error {
	from, err := mail.ParseAddress(s.From)
	if err != nil || from.Address == "" {
		return fmt.Errorf("invalid sender address")
	}
	to, err := mail.ParseAddress(msg.to)
	if err != nil || to.Address == "" {
		return fmt.Errorf("invalid recipient address")
	}

	host, _, err := net.SplitHostPort(s.Address)
	if err != nil {
		return fmt.Errorf("invalid SMTP address")
	}
	deadline := time.Now().Add(10 * time.Second)
	if ctxDeadline, ok := ctx.Deadline(); ok && ctxDeadline.Before(deadline) {
		deadline = ctxDeadline
	}
	dialer := net.Dialer{Timeout: time.Until(deadline)}
	conn, err := dialer.DialContext(ctx, "tcp", s.Address)
	if err != nil {
		return fmt.Errorf("connect SMTP: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(deadline)
	stopCancel := context.AfterFunc(ctx, func() { _ = conn.SetDeadline(time.Now()) })
	defer stopCancel()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("start SMTP session")
	}
	defer client.Close()
	if err := client.Hello("localhost"); err != nil {
		return fmt.Errorf("SMTP hello failed")
	}
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("SMTP TLS negotiation failed")
		}
	} else if s.RequireStartTLS {
		return fmt.Errorf("SMTP server does not support required STARTTLS")
	}
	if s.Username != "" || s.Password != "" {
		if s.Username == "" || s.Password == "" {
			return fmt.Errorf("SMTP username and password must both be configured")
		}
		if err := client.Auth(smtp.PlainAuth("", s.Username, s.Password, host)); err != nil {
			return fmt.Errorf("SMTP authentication failed")
		}
	}
	if err := client.Mail(msg.from); err != nil {
		return fmt.Errorf("SMTP sender was rejected")
	}
	if err := client.Rcpt(msg.to); err != nil {
		return fmt.Errorf("SMTP recipient was rejected")
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP message was rejected")
	}
	if _, err := writer.Write([]byte(msg.content)); err != nil {
		_ = writer.Close()
		return fmt.Errorf("SMTP message write failed")
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("SMTP message delivery was rejected")
	}
	_ = client.Quit()
	return nil
}
