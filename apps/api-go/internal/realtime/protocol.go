// Package realtime provides WebSocket-based realtime communication for battle
// and presence features, replacing the NestJS Socket.IO gateways.
package realtime

import (
	"encoding/json"
	"fmt"
)

// Message is the JSON-framed protocol envelope for all WebSocket messages.
// Client→Server: {"event":"battle:lobby_join","data":{...},"id":"optional-ack-id"}
// Server→Client: {"event":"battle:lobby_joined","data":{...}}
type Message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data,omitempty"`
	ID    string          `json:"id,omitempty"`
}

// Encode serializes a Message to JSON bytes for wire transmission.
func Encode(event string, data any) ([]byte, error) {
	var raw json.RawMessage
	if data != nil {
		b, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("encode %s: %w", event, err)
		}
		raw = b
	}
	msg := Message{Event: event, Data: raw}
	return json.Marshal(msg)
}

// EncodeWithID serializes a Message with an acknowledgement ID.
func EncodeWithID(event, id string, data any) ([]byte, error) {
	var raw json.RawMessage
	if data != nil {
		b, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("encode %s: %w", event, err)
		}
		raw = b
	}
	msg := Message{Event: event, Data: raw, ID: id}
	return json.Marshal(msg)
}

// Decode parses raw JSON bytes into a Message.
func Decode(b []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(b, &msg); err != nil {
		return nil, fmt.Errorf("decode message: %w", err)
	}
	if msg.Event == "" {
		return nil, fmt.Errorf("decode message: missing event field")
	}
	return &msg, nil
}

// ErrorPayload is the standard error response shape.
type ErrorPayload struct {
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}
